// Typed schema for the standing evaluation harness.
//
// The five standing questions come from the spec (art_Ene8eA8R): every change to
// the assistant must move at least one of them. Cases are written in the office's
// own words; expectations are hand-labeled. All fixtures are synthetic.

export type StandingQuestionId =
  'candidates' | 'traceability' | 'unknown-honesty' | 'verification-honesty' | 'clarify-not-guess';

export const STANDING_QUESTIONS = [
  'candidates',
  'traceability',
  'unknown-honesty',
  'verification-honesty',
  'clarify-not-guess',
] as const satisfies readonly StandingQuestionId[];

export const STANDING_QUESTION_LABELS: Record<StandingQuestionId, string> = {
  candidates: 'Finds the right candidates for questions asked in the office’s own words',
  traceability: 'Every stated value is checkable — document, locator, quote, verification state',
  'unknown-honesty': 'Missing support stays unknown or refuses — never filled in',
  'verification-honesty': 'Verification state is never overstated',
  'clarify-not-guess': 'Ambiguous questions get a question back; unsupported ones get a refusal',
};

export type CaseKind = 'discovery' | 'single-product' | 'code' | 'ambiguous' | 'unsupported';

export const CASE_KINDS: readonly CaseKind[] = [
  'discovery',
  'single-product',
  'code',
  'ambiguous',
  'unsupported',
];

export interface EvalCase {
  /** Stable id, e.g. 'tc-1-discovery-task-chairs' — never renamed silently. */
  id: string;
  title: string;
  kind: CaseKind;
  /** The question exactly as the user would ask it. */
  question: string;
  expected: {
    /** Product ids a correct answer must contain, and only these. Omit when any answer would be a guess. */
    candidateIds?: string[];
    /** Properties that must stay unknown — the corpus cannot support a value for them. */
    unknownProperties?: string[];
  };
}

// --- The reasoner's proposal -------------------------------------------------
// The scripted engine stands in for the reasoner behind its interface. Drafts
// propose references to library records — never values: the type has no field a
// value or a quote could hide in (the spec's boundary invariant, structural).

export type Verification = 'human-verified' | 'interpreted' | 'machine-read';

export interface ScriptedRecord {
  id: string;
  propertyId: string;
  documentTitle: string;
  locator: string;
  quote: string;
  verification: Verification;
  /** Required when verification is 'human-verified' — checked by the verification-honesty grader. */
  verifiedBy?: string;
}

export type EngineOutcome = 'answer' | 'clarify' | 'refuse';

export interface ProposedClaim {
  recordId: string;
}

export interface ProposedCandidate {
  productId: string;
  claims: ProposedClaim[];
}

export interface ProposedUnknown {
  propertyId: string;
  reason: string;
}

export interface AnswerDraft {
  outcome: EngineOutcome;
  candidates?: ProposedCandidate[];
  unknowns?: ProposedUnknown[];
}

export type ResolveRecord = (recordId: string) => ScriptedRecord | undefined;

// --- Grading results ----------------------------------------------------------

export type Verdict = 'pass' | 'fail';

export interface QuestionVerdict {
  verdict: Verdict;
  reason: string;
}

export interface CaseResult {
  caseId: string;
  outcome: EngineOutcome;
  passed: boolean;
  questions: Record<StandingQuestionId, QuestionVerdict>;
}

export interface QuestionSummary {
  passed: number;
  failed: number;
}

export interface HarnessResults {
  harnessVersion: 1;
  engine: string;
  perQuestion: Record<StandingQuestionId, QuestionSummary>;
  cases: CaseResult[];
  allPassed: boolean;
}

// --- Parsers ------------------------------------------------------------------
// Structural validation with honest errors: a malformed case or results file
// fails the run loudly, never the grading silently.

export class CaseParseError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, at: string, source: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    throw new CaseParseError(`${source}: ${at}: expected a non-empty array of strings`);
  }
  return value as string[];
}

export function parseCaseFile(raw: unknown, source: string): EvalCase[] {
  if (!isObject(raw) || !Array.isArray(raw['cases'])) {
    throw new CaseParseError(`${source}: expected an object with a "cases" array`);
  }
  return raw['cases'].map((entry, index) => {
    const at = `cases[${index}]`;
    if (!isObject(entry)) throw new CaseParseError(`${source}: ${at}: expected an object`);

    const id = entry['id'];
    const title = entry['title'];
    const kind = entry['kind'];
    const question = entry['question'];
    if (typeof id !== 'string' || id.trim() === '') {
      throw new CaseParseError(`${source}: ${at}.id: non-empty string required`);
    }
    if (typeof title !== 'string' || title.trim() === '') {
      throw new CaseParseError(`${source}: ${at}.title: non-empty string required`);
    }
    if (typeof kind !== 'string' || !CASE_KINDS.includes(kind as CaseKind)) {
      throw new CaseParseError(
        `${source}: ${at}.kind: unknown kind ${JSON.stringify(kind)} (expected one of ${CASE_KINDS.join(', ')})`
      );
    }
    if (typeof question !== 'string' || question.trim() === '') {
      throw new CaseParseError(`${source}: ${at}.question: non-empty string required`);
    }

    const parsed: EvalCase = { id, title, kind: kind as CaseKind, question, expected: {} };

    const expected = entry['expected'];
    if (expected !== undefined) {
      if (!isObject(expected))
        throw new CaseParseError(`${source}: ${at}.expected: expected an object`);
      const candidateIds = expected['candidateIds'];
      const unknownProperties = expected['unknownProperties'];
      if (candidateIds !== undefined) {
        parsed.expected.candidateIds = stringArray(
          candidateIds,
          `${at}.expected.candidateIds`,
          source
        );
      }
      if (unknownProperties !== undefined) {
        parsed.expected.unknownProperties = stringArray(
          unknownProperties,
          `${at}.expected.unknownProperties`,
          source
        );
      }
    }
    return parsed;
  });
}

export function parseHarnessResults(raw: unknown, source: string): HarnessResults {
  if (!isObject(raw)) throw new CaseParseError(`${source}: expected a results object`);
  if (raw['harnessVersion'] !== 1) {
    throw new CaseParseError(
      `${source}: unsupported harnessVersion ${JSON.stringify(raw['harnessVersion'])}`
    );
  }
  const engine = raw['engine'];
  if (typeof engine !== 'string' || engine === '') {
    throw new CaseParseError(`${source}: engine must be a non-empty string`);
  }

  const perQuestionRaw = raw['perQuestion'];
  if (!isObject(perQuestionRaw))
    throw new CaseParseError(`${source}: perQuestion must be an object`);
  const perQuestion = {} as Record<StandingQuestionId, QuestionSummary>;
  for (const question of STANDING_QUESTIONS) {
    const entry = perQuestionRaw[question];
    if (
      !isObject(entry) ||
      typeof entry['passed'] !== 'number' ||
      typeof entry['failed'] !== 'number'
    ) {
      throw new CaseParseError(
        `${source}: perQuestion.${question}: { passed, failed } numbers required`
      );
    }
    perQuestion[question] = { passed: entry['passed'], failed: entry['failed'] };
  }

  if (!Array.isArray(raw['cases'])) throw new CaseParseError(`${source}: cases must be an array`);
  const cases: CaseResult[] = raw['cases'].map((entry, index) => {
    const at = `cases[${index}]`;
    if (!isObject(entry)) throw new CaseParseError(`${source}: ${at}: expected an object`);

    const caseId = entry['caseId'];
    const outcome = entry['outcome'];
    const passed = entry['passed'];
    if (typeof caseId !== 'string' || typeof outcome !== 'string' || typeof passed !== 'boolean') {
      throw new CaseParseError(
        `${source}: ${at}: caseId (string), outcome (string), passed (boolean) required`
      );
    }

    const questionsRaw = entry['questions'];
    if (!isObject(questionsRaw))
      throw new CaseParseError(`${source}: ${at}.questions must be an object`);
    const questions = {} as Record<StandingQuestionId, QuestionVerdict>;
    for (const question of STANDING_QUESTIONS) {
      const verdict = questionsRaw[question];
      if (
        !isObject(verdict) ||
        (verdict['verdict'] !== 'pass' && verdict['verdict'] !== 'fail') ||
        typeof verdict['reason'] !== 'string'
      ) {
        throw new CaseParseError(
          `${source}: ${at}.questions.${question}: { verdict, reason } required`
        );
      }
      questions[question] = { verdict: verdict['verdict'], reason: verdict['reason'] };
    }

    return { caseId, outcome: outcome as EngineOutcome, passed, questions };
  });

  const allPassed = raw['allPassed'];
  if (typeof allPassed !== 'boolean')
    throw new CaseParseError(`${source}: allPassed must be a boolean`);

  return { harnessVersion: 1, engine, perQuestion, cases, allPassed };
}
