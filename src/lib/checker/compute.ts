// Computation — the deciding half of the assertion checker (spec art_Ene8eA8R,
// "Two authorities"). Every cell of the candidate matrix is computed here from
// recorded evidence, or it is unknown with a reason and what would resolve it.
// The decision path is pure: values and requirements in, verdicts out — the
// library and the methods registry are behind injected, prefetched lookups.
//
// Cross-method comparisons are gated through the registry's decision — never
// assumed. An unregistered method pair and a registry outage are integrity
// gaps surfaced as unknowns, never coerced into not-comparable.

import type { LibraryRecord, LibraryValueRecord, RequirementCheck } from '@/lib/reasoner/types';
import type { ComparabilityDecision } from '@/lib/registry/comparability';
import type { CheckedRequirement, Comparator, ComparisonOutcome, RequirementResult } from './types';

/** Narrow a resolved record to the value records computation may use. */
function asValue(record: LibraryRecord): LibraryValueRecord | undefined {
  return record.kind === 'value' ? record : undefined;
}

/** How a recorded value reads, for reasons — raw as the source words it, under its method. */
function asRecorded(value: LibraryValueRecord): string {
  return `'${value.raw}' ('${value.methodId}')`;
}

/**
 * One per-value comparison outcome before folding. A value can meet (raw
 * equality, directly or across a registry-blessed bridge), fail (recorded and
 * unequal), or be unknown (the pair must not be set side by side, or the
 * account could not be consulted).
 */
interface ValueOutcome {
  verdict: 'meet' | 'fail' | 'unknown';
  reason: string;
  wouldResolve?: string;
  comparability?: ComparabilityDecision;
}

const UNREGISTERED_RESOLVE =
  'register the method in the methods account, or compare values under methods it knows';

/**
 * The registry gate's outcome: either raw equality may proceed across the
 * bridge (with the decision recorded for the answer), or the cell stops as an
 * explained unknown. The gate never decides meet or fail — only the account
 * can bless a comparison, and only raw equality against the recorded value
 * can produce a verdict.
 */
type MethodGate =
  | { proceed: true; comparability?: ComparabilityDecision }
  | { proceed: false; outcome: ValueOutcome };

function gateComparison(
  value: LibraryValueRecord,
  expectedMethodId: string,
  compare: Comparator
): MethodGate {
  const outcome: ComparisonOutcome = compare(value.methodId, expectedMethodId);
  // ComparabilityDecision carries no discriminant — the tag does the narrowing.
  if ('kind' in outcome) {
    if (outcome.kind === 'unregistered') {
      return {
        proceed: false,
        outcome: {
          verdict: 'unknown',
          reason: `the value is recorded under '${value.methodId}', but the methods account does not register '${expectedMethodId}' — an integrity gap, not a comparison`,
          wouldResolve: UNREGISTERED_RESOLVE,
        },
      };
    }
    return {
      proceed: false,
      outcome: {
        verdict: 'unknown',
        reason: `the methods account could not be consulted for '${value.methodId}' against '${expectedMethodId}' — an outage is not a comparability verdict`,
        wouldResolve: 'retry — the comparison re-runs against the account when it answers',
      },
    };
  }
  if (outcome.verdict === 'not-comparable') {
    return {
      proceed: false,
      outcome: {
        verdict: 'unknown',
        reason: `the value is recorded as ${asRecorded(value)}, which the account does not link to '${expectedMethodId}' — the two must not be set side by side`,
        wouldResolve: `a value recorded under '${expectedMethodId}', or an explicit comparability edge in the account`,
        comparability: outcome,
      },
    };
  }
  return { proceed: true, comparability: outcome };
}

/**
 * Compute one check (raw-equals / raw-not-equals) against one attributable
 * value. Pure — every branch is a recorded fact or an explained unknown.
 */
function checkAgainstValue(
  check: RequirementCheck & { kind: 'raw-equals' | 'raw-not-equals' },
  value: LibraryValueRecord,
  compare: Comparator
): ValueOutcome {
  const equals = check.kind === 'raw-equals';
  const want = check.raw;
  const expected = check.methodId;
  let comparability: ComparabilityDecision | undefined;
  if (expected !== undefined && value.methodId !== expected) {
    const gate = gateComparison(value, expected, compare);
    if (!gate.proceed) return gate.outcome;
    comparability = gate.comparability;
  }
  const recorded = asRecorded(value);
  const expect = `'${want}'${expected !== undefined ? ` under '${expected}'` : ''}`;
  if (value.raw === want) {
    return {
      verdict: 'meet',
      reason: equals
        ? `recorded as ${recorded} — equal to ${expect}`
        : `recorded as ${recorded} — not ${expect}, which is what the requirement asks`,
      comparability,
    };
  }
  return {
    verdict: 'fail',
    reason: equals
      ? `recorded as ${recorded} — not equal to ${expect}`
      : `recorded as ${recorded} — equal to ${expect}, which the requirement excludes`,
    comparability,
  };
}

/**
 * Fold per-value outcomes into one cell. Precedence is meet > fail > unknown:
 * any attributable value that meets settles the cell as met with that
 * evidence; failing evidence is cited when nothing meets; unknowns from
 * non-comparability stand only when no recorded value decided anything.
 */
function foldOutcomes(
  outcomes: readonly ValueOutcome[],
  recordedSummary: string,
  equals: boolean
): {
  verdict: 'meet' | 'fail' | 'unknown';
  reason: string;
  wouldResolve?: string;
  comparability?: ComparabilityDecision;
} {
  const met = outcomes.find((o) => o.verdict === 'meet');
  if (met !== undefined) {
    return { verdict: 'meet', reason: met.reason, comparability: met.comparability };
  }
  const failed = outcomes.find((o) => o.verdict === 'fail');
  if (failed !== undefined) {
    return { verdict: 'fail', reason: failed.reason, comparability: failed.comparability };
  }
  const gated = outcomes.find((o) => o.verdict === 'unknown' && o.reason !== '');
  if (gated !== undefined) {
    return {
      verdict: 'unknown',
      reason: gated.reason,
      wouldResolve: gated.wouldResolve,
      comparability: gated.comparability,
    };
  }
  // Values were recorded but none decided the check — say so, and what to seek.
  return {
    verdict: 'unknown',
    reason: `recorded values (${recordedSummary}) did not decide the check — nothing equaled what the requirement ${equals ? 'asks for' : 'excludes'}`,
    wouldResolve: 'the document that records the property in the form the requirement states it',
  };
}

/**
 * Compute one cell of the candidate matrix: one requirement against one
 * candidate's attributable values for the requirement's property. The check is
 * the requirement's proposed checkable reading, executed — never invented.
 * Compliance without a readable check is unknown, never judged.
 */
export function computeRequirement(
  requirement: CheckedRequirement,
  requirementIndex: number,
  values: readonly LibraryValueRecord[],
  compare: Comparator
): RequirementResult {
  const base = { requirementIndex, propertyId: requirement.propertyId };
  const recordedSummary = values.map(asRecorded).join(', ');
  const check = requirement.check;
  if (check === undefined) {
    return {
      ...base,
      verdict: 'unknown',
      reason: `the requirement '${requirement.statement}' was not stated in a checkable form — compliance is unknown rather than judged`,
      wouldResolve: 'state the check as present, absent, raw-equals or raw-not-equals, then re-run',
      evidence: [],
    };
  }
  if (values.length === 0) {
    if (check.kind === 'absent') {
      // Spec promise: not-found never implies the property is absent — a full
      // search that found none cannot establish that nothing is there.
      return {
        ...base,
        verdict: 'unknown',
        reason: `nothing is recorded for '${requirement.propertyId}', and absence of evidence is not evidence of absence`,
        wouldResolve: `the document that would record '${requirement.propertyId}' if it existed — until then absence stays unknown`,
        evidence: [],
      };
    }
    return {
      ...base,
      verdict: 'unknown',
      reason: `nothing is recorded for '${requirement.propertyId}'`,
      wouldResolve: `the document that records '${requirement.propertyId}' — a certificate, listing, or spec sheet entry`,
      evidence: [],
    };
  }
  if (check.kind === 'present') {
    return {
      ...base,
      verdict: 'meet',
      reason: `the property is recorded — ${recordedSummary}`,
      evidence: [...values],
    };
  }
  if (check.kind === 'absent') {
    return {
      ...base,
      verdict: 'fail',
      reason: `a value is recorded — ${recordedSummary} — so '${requirement.propertyId}' is not absent`,
      evidence: [...values],
    };
  }
  // raw-equals / raw-not-equals: every attributable value is checked; the
  // fold reports the strongest outcome with the evidence that decided it.
  const outcomes = values.map((value) => checkAgainstValue(check, value, compare));
  const folded = foldOutcomes(outcomes, recordedSummary, check.kind === 'raw-equals');
  return {
    ...base,
    ...folded,
    evidence: [...values],
  };
}

/**
 * Compute one candidate's row: one result per requirement, in requirement
 * order. Only attributable value records (records whose recorded product is
 * this candidate's) reach this point — resolution checked that already.
 */
export function computeCandidate(
  productId: string,
  records: readonly LibraryRecord[],
  requirements: readonly CheckedRequirement[],
  compare: Comparator
): { productId: string; results: RequirementResult[] } {
  const values = records.flatMap((record) => {
    const value = asValue(record);
    return value !== undefined ? [value] : [];
  });
  const results = requirements.map((requirement, index) => {
    const forProperty = values.filter((value) => value.propertyId === requirement.propertyId);
    return computeRequirement(requirement, index, forProperty, compare);
  });
  return { productId, results };
}
