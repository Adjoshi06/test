// The assertion checker's output contract — the deterministic authority of the
// two-authority boundary (spec art_Ene8eA8R, "Two authorities").
//
// The reasoner proposes; the checker is the only code path that may attach a
// value to an answer. Everything it emits is computed from library records it
// resolved through an injected port, or it is unknown with a reason and what
// would resolve it. Nothing here is judged: meet/fail come from executing the
// requirement's proposed check against recorded raws; comparability comes from
// the methods registry's decision; authority conflicts are surfaced, not
// blended.

import type {
  Interpretation,
  LibraryRecord,
  QuestionBack,
  Refusal,
  RequirementCheck,
  RequirementSource,
} from '@/lib/reasoner/types';
import type { ComparabilityDecision } from '@/lib/registry/comparability';

/** The only verdicts that exist. Computed from recorded evidence, or unknown — never judged. */
export type ComplianceVerdict = 'meet' | 'fail' | 'unknown';

/**
 * Why an unknown exists. `not-found` and `search-failed` are the reasoner's
 * search outcomes, carried through distinctly (spec promise: unknown is an
 * answer); the rest are the checker's own strip outcomes — every way a
 * malformed or unresolvable draft piece survives by becoming unknown.
 */
export type CheckedUnknownStatus =
  | 'not-found' // the draft reported: a search ran and found nothing
  | 'search-failed' // the draft reported: the search did not complete
  | 'unresolved-ref' // stripped: no library record answers the reference (missing, or not visible to the viewer)
  | 'unattributable' // stripped: the record exists but belongs to another product — the draft may not re-attribute it
  | 'not-a-value' // stripped: the record is source text (a passage), not a recorded value — nobody has read a value out of it
  | 'unreadable'; // stripped: the draft piece (or the library record itself) could not be read at all

export interface CheckedUnknown {
  /** Canonical property id, or '*' when the whole question lacks support. */
  propertyId: string;
  status: CheckedUnknownStatus;
  /** Why it is unknown — never empty (the checker rewrites reasonless rows rather than carrying them). */
  reason: string;
  /** What would resolve it: a document to obtain, a question to ask, a search to retry. Never empty. */
  wouldResolve: string;
  /** Set when the unknown was stripped from a candidate's claim. */
  productId?: string;
  /** The referenced record id, when there was one. */
  recordId?: string;
}

/** Part 2 of the answer — the requirement as checked, with its source and its proposed reading. */
export interface CheckedRequirement {
  propertyId: string;
  statement: string;
  source: RequirementSource;
  /** The proposed checkable reading; absent when the requirement is not stated in a checkable form. */
  check?: RequirementCheck;
}

/** One requirement × one candidate cell of the candidate matrix. */
export interface RequirementResult {
  /** Index into `CheckedAnswer.requirements` — the matrix column this verdict belongs to. */
  requirementIndex: number;
  propertyId: string;
  verdict: ComplianceVerdict;
  /** The computed why — cites the recorded raw and, when compared across methods, the registry's basis. */
  reason: string;
  /** Every recorded value the verdict was computed from — one step from the evidence. */
  evidence: LibraryRecord[];
  /** Present when the comparison crossed methods and was gated through the registry. */
  comparability?: ComparabilityDecision;
}

/** Part 3 — one candidate row of the matrix, one result per requirement, in requirement order. */
export interface CandidateResult {
  productId: string;
  results: RequirementResult[];
}

/** Authorities that disagree, both shown — never blended (spec promise). */
export interface CheckedConflict {
  /** `evidence`: recorded values disagree about a property. `requirement`: a non-code expectation contradicts a code the same property carries. */
  kind: 'evidence' | 'requirement';
  propertyId: string;
  /** Set for evidence conflicts — the disagreement is about one candidate's value. */
  productId?: string;
  /** Both sides verbatim: raws, authorities, locators — or the two requirement statements and their sources. */
  description: string;
  /** Evidence conflict: the disagreeing value records, in id order. */
  recordIds?: string[];
  /** Requirement conflict: [code side, other side] indexes into `CheckedAnswer.requirements`. */
  requirementIndexes?: [number, number];
}

/**
 * The checked answer — the only answer shape that exists. Parts 1 and 4 are
 * the draft's own words carried through unchanged (the UI renders them as the
 * assistant's, visibly separated from evidence); parts 2, 3, 5 and 6 are
 * computed by the checker.
 */
export interface CheckedAnswer {
  outcome: 'answer' | 'clarify' | 'refuse';
  /** Part 1 — the assistant's interpretation, carried through. */
  interpretation: Interpretation[];
  /** Part 2 — the requirements that applied, with their sources. Empty for clarify and refuse outcomes. */
  requirements: CheckedRequirement[];
  /** Part 3 — the candidate matrix. Computed for answer outcomes only. */
  results: CandidateResult[];
  /** Part 4 — the assistant's own words, carried through. */
  commentary: string[];
  /** Part 5 — unknowns: the draft's search outcomes plus every stripped claim, each with its reason and what would resolve it. */
  unknowns: CheckedUnknown[];
  /** Part 6 — every resolved record, deduplicated, in id order. One step from every value. */
  evidence: LibraryRecord[];
  /** Authorities that disagree — evidence conflicts and requirement conflicts, both shown. */
  conflicts: CheckedConflict[];
  questionBack?: QuestionBack;
  refusal?: Refusal;
}

// --- The injected ports -------------------------------------------------------
// The checker's only contact with the world. Lookups are injected; the decision
// path is pure (spec: the checker and eval harness are plain typed functions).

/** The library, as the checker sees it — viewer-scoped by whoever wires it. */
export interface CheckerRecordPort {
  /**
   * Resolve record ids to library records; null for a record that does not
   * exist or is not visible to the viewer — invisibility must not leak
   * existence, so the two are indistinguishable here too.
   */
  getRecords(recordIds: readonly string[]): Promise<ReadonlyMap<string, LibraryRecord | null>>;
}

/** The methods registry, as the checker sees it. */
export interface CheckerComparisonPort {
  /**
   * The registry's comparison decision for a method pair. Throws
   * RegistryNotFoundError for an unregistered method — an integrity gap the
   * checker surfaces as its own unknown, never coerces into a verdict.
   */
  compareMethods(aMethodId: string, bMethodId: string): Promise<ComparabilityDecision>;
}

/**
 * A comparison outcome inside the pure decision path: the registry's decision,
 * or the fact that the account does not register the method pair. Deliberately
 * not a ComparabilityDecision — an unregistered method is an integrity gap to
 * surface, not a not-comparable verdict (registry/errors.ts).
 */
export type ComparisonOutcome =
  ComparabilityDecision | { kind: 'unregistered'; methodIds: [string, string] };

/** Pure comparison lookup the assembler uses — built by the orchestrator over prefetched decisions. */
export type Comparator = (aMethodId: string, bMethodId: string) => ComparisonOutcome;

/** Everything the pure assembler needs, already resolved. */
export interface Resolution {
  /** Library records by requested id, as recorded. Absent entries and nulls did not resolve. */
  records: ReadonlyMap<string, LibraryRecord | null>;
  /** Pure comparison lookup — answerable for every cross-method pair the draft can reach. */
  compare: Comparator;
}
