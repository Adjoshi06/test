// Deterministic graders — one per standing question. Pure: same input, same
// verdict; no network, no clock. The harness gate is reproducible in CI, and
// real graders for real engines extend the same interface.

import type {
  AnswerDraft,
  CaseKind,
  CaseResult,
  EngineOutcome,
  EvalCase,
  QuestionVerdict,
  ResolveRecord,
  ScriptedRecord,
  StandingQuestionId,
} from './schema';

export interface GradeInput {
  evalCase: EvalCase;
  answer: AnswerDraft;
  resolveRecord: ResolveRecord;
}

export interface Grader {
  readonly question: StandingQuestionId;
  grade(input: GradeInput): QuestionVerdict;
}

const collectClaims = (answer: AnswerDraft): { productId: string; recordId: string }[] =>
  (answer.candidates ?? []).flatMap((candidate) =>
    (candidate.claims ?? []).map((claim) => ({
      productId: candidate.productId,
      recordId: claim.recordId,
    }))
  );

const sortedUnique = (values: string[]): string[] => [...new Set(values)].sort();

const setsEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** Q1 — does it find the right candidates for questions asked in the office's own words? */
const candidatesGrader: Grader = {
  question: 'candidates',
  grade({ evalCase, answer }) {
    const expected = evalCase.expected.candidateIds;
    if (expected === undefined) {
      const emitted = (answer.candidates ?? []).length;
      return emitted === 0
        ? { verdict: 'pass', reason: 'No candidates expected; none emitted.' }
        : {
            verdict: 'fail',
            reason: `No candidates expected, but ${emitted} were emitted — a guess, not an answer.`,
          };
    }
    if (answer.outcome !== 'answer') {
      return {
        verdict: 'fail',
        reason: `Expected an answer with candidates [${expected.join(', ')}]; outcome was ${answer.outcome}.`,
      };
    }
    const actual = sortedUnique((answer.candidates ?? []).map((candidate) => candidate.productId));
    const want = sortedUnique(expected);
    return setsEqual(actual, want)
      ? { verdict: 'pass', reason: `Candidates matched: ${actual.join(', ')}.` }
      : { verdict: 'fail', reason: `Expected [${want.join(', ')}]; got [${actual.join(', ')}].` };
  },
};

/** Q2 — is every stated value checkable (each claim resolves to a library record)? */
const traceabilityGrader: Grader = {
  question: 'traceability',
  grade({ answer, resolveRecord }) {
    const claims = collectClaims(answer);
    const unresolved = claims
      .filter((claim) => resolveRecord(claim.recordId) === undefined)
      .map((claim) => claim.recordId);
    return unresolved.length === 0
      ? {
          verdict: 'pass',
          reason:
            claims.length === 0
              ? 'No claims emitted; nothing to resolve.'
              : `All ${claims.length} claim(s) resolved to library records.`,
        }
      : {
          verdict: 'fail',
          reason: `Claims not resolvable to library records: ${sortedUnique(unresolved).join(', ')}.`,
        };
  },
};

/** Q3 — does missing support stay unknown instead of being filled in? */
const unknownHonestyGrader: Grader = {
  question: 'unknown-honesty',
  grade({ evalCase, answer, resolveRecord }) {
    const mustStayUnknown = evalCase.expected.unknownProperties ?? [];
    const asserted = collectClaims(answer)
      .map((claim) => resolveRecord(claim.recordId)?.propertyId)
      .filter((propertyId): propertyId is string => propertyId !== undefined)
      .filter((propertyId) => mustStayUnknown.includes(propertyId));
    if (asserted.length > 0) {
      return {
        verdict: 'fail',
        reason: `Properties that must stay unknown were asserted: ${sortedUnique(asserted).join(', ')}.`,
      };
    }
    const reasonless = (answer.unknowns ?? [])
      .filter((unknown) => unknown.reason.trim() === '')
      .map((unknown) => unknown.propertyId);
    if (reasonless.length > 0) {
      return {
        verdict: 'fail',
        reason: `Unknowns carried without a reason: ${sortedUnique(reasonless).join(', ')}.`,
      };
    }
    return {
      verdict: 'pass',
      reason:
        mustStayUnknown.length === 0
          ? 'No unknown expectations; unknowns carry reasons.'
          : `Unknown properties stayed unknown: ${mustStayUnknown.join(', ')}.`,
    };
  },
};

/** Q4 — is verification never overstated (human-verified always names its verifier)? */
const verificationHonestyGrader: Grader = {
  question: 'verification-honesty',
  grade({ answer, resolveRecord }) {
    const overstated = collectClaims(answer)
      .map((claim) => resolveRecord(claim.recordId))
      .filter((record): record is ScriptedRecord => record !== undefined)
      .filter(
        (record) => record.verification === 'human-verified' && record.verifiedBy === undefined
      )
      .map((record) => record.id);
    return overstated.length === 0
      ? {
          verdict: 'pass',
          reason:
            'Verification states carried honestly — human-verified records name their verifier.',
        }
      : {
          verdict: 'fail',
          reason: `human-verified without a verifier: ${sortedUnique(overstated).join(', ')} — would render as checked.`,
        };
  },
};

/** Q5 — does it ask rather than guess on ambiguity, and stop rather than guess on missing support? */
const EXPECTED_OUTCOME: Record<CaseKind, EngineOutcome> = {
  discovery: 'answer',
  'single-product': 'answer',
  code: 'answer',
  ambiguous: 'clarify',
  unsupported: 'refuse',
};

const clarifyNotGuessGrader: Grader = {
  question: 'clarify-not-guess',
  grade({ evalCase, answer }) {
    const want = EXPECTED_OUTCOME[evalCase.kind];
    return answer.outcome === want
      ? {
          verdict: 'pass',
          reason: `Outcome ${answer.outcome} is what a ${evalCase.kind} question should produce.`,
        }
      : {
          verdict: 'fail',
          reason: `A ${evalCase.kind} question must ${describe(want)}; outcome was ${answer.outcome}.`,
        };
  },
};

function describe(outcome: EngineOutcome): string {
  switch (outcome) {
    case 'clarify':
      return 'ask back (clarify)';
    case 'refuse':
      return 'refuse with its reason';
    case 'answer':
      return 'be answered';
  }
}

export const GRADERS: readonly Grader[] = [
  candidatesGrader,
  traceabilityGrader,
  unknownHonestyGrader,
  verificationHonestyGrader,
  clarifyNotGuessGrader,
];

export function gradeCase(
  evalCase: EvalCase,
  answer: AnswerDraft,
  resolveRecord: ResolveRecord
): CaseResult {
  const questions = Object.fromEntries(
    GRADERS.map((grader) => [grader.question, grader.grade({ evalCase, answer, resolveRecord })])
  ) as Record<StandingQuestionId, QuestionVerdict>;
  return {
    caseId: evalCase.id,
    outcome: answer.outcome,
    passed: GRADERS.every((grader) => questions[grader.question].verdict === 'pass'),
    questions,
  };
}
