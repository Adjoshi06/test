/**
 * The comparison decision — pure, so the rule is searchable and testable
 * without a database. The service resolves the edge; this decides.
 */

/**
 * How the decision was reached. The assertion checker renders this basis —
 * it never renders a judgment of its own.
 */
export type ComparabilityBasis =
  | 'same-method' // one method needs no bridge
  | 'explicit-edge' // the account grants comparability
  | 'known-incomparable' // the account records the pair as not comparable
  | 'no-edge'; // no account links the pair — refused, never assumed

export type ComparabilityVerdict = 'comparable' | 'not-comparable';

export interface ComparabilityDecision {
  verdict: ComparabilityVerdict;
  basis: ComparabilityBasis;
  /** Human-readable why — rendered with the verdict. */
  reason: string;
}

/** The resolved edge, direction-agnostic — the caller looks it up. */
export interface EdgeSummary {
  comparable: boolean;
  note: string;
}

/**
 * Canonical direction of an unordered method pair. Ids are lowercase ASCII
 * slugs (enforced by the schema), so JS string order and SQL text order
 * agree — one row per pair is stored `from < to`, and the lookup normalizes
 * through the same function.
 */
export function orderedMethods(aId: string, bId: string): [string, string] {
  return aId < bId ? [aId, bId] : [bId, aId];
}

/**
 * The single place a pair of methods becomes comparable or not. Only an
 * explicit edge confers comparability — a matching quantity, a similar name,
 * or anything else about the pair never does.
 */
export function decideComparability(
  aId: string,
  bId: string,
  edge: EdgeSummary | null
): ComparabilityDecision {
  if (aId === bId) {
    return {
      verdict: 'comparable',
      basis: 'same-method',
      reason: `Both values sit under the same method (${aId}) — nothing to bridge.`,
    };
  }
  if (edge === null) {
    return {
      verdict: 'not-comparable',
      basis: 'no-edge',
      reason: `No comparability account links ${aId} and ${bId}; the values must not be set side by side.`,
    };
  }
  if (!edge.comparable) {
    return {
      verdict: 'not-comparable',
      basis: 'known-incomparable',
      reason: `${aId} and ${bId} are known not comparable — ${edge.note}`,
    };
  }
  return {
    verdict: 'comparable',
    basis: 'explicit-edge',
    reason: `Comparable per the registry account — ${edge.note}`,
  };
}
