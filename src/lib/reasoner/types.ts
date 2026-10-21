// The reasoner's proposal types — the model half of the two-authority boundary
// (spec art_Ene8eA8R, "Two authorities").
//
// The reasoner interprets, selects and proposes; it never asserts. A draft is a
// bag of references and labelled judgment: candidate claims carry library record
// ids — never values, never quotes, never product facts of the model's own. The
// assertion checker (separate module, separate task) is the only code path that
// may attach a value to an answer.
//
// These types are the shared contract the library task adopts: a record here is
// exactly what a claim may reference, and every record carries its evidence.

/** Where a library record's authority comes from. Recorded by the library or a reviewer — never by the model. */
export type Authority = 'product-doc' | 'code' | 'project' | 'correspondence';

/**
 * How a record's content was verified. The five states are shown differently in
 * the answer UI; only 'human-verified' may ever present as checked.
 */
export type VerificationState = 'human-verified' | 'interpreted' | 'machine-read';

export interface LibraryRecordBase {
  /** Stable id, e.g. 'rec-halden-fire-certificate' — the only thing a claim carries. */
  id: string;
  kind: 'value' | 'passage';
  authority: Authority;
  verification: VerificationState;
  /** Who checked it — present only when verification is 'human-verified'. */
  verifiedBy?: string;
  // Evidence — the spec's EvidenceRef, flattened one level so a claim resolves in one step.
  documentId: string;
  documentTitle: string;
  /** Where it sits, e.g. 'p. 12, §4.2' or 'msg 14 Mar, author PM'. */
  locator: string;
  /** Verbatim span from the document. */
  quote: string;
}

/** An extracted value: the library records it; the model may only reference it. */
export interface LibraryValueRecord extends LibraryRecordBase {
  kind: 'value';
  productId: string;
  /** Canonical property id, e.g. 'fire-rating'. */
  propertyId: string;
  /** The value exactly as the source words it. */
  raw: string;
  /** Measurement or classification method, e.g. 'en-13501-1' — comparability lives in the methods registry. */
  methodId: string;
}

/** Source text without an extracted value: a brief paragraph, a code excerpt, a correspondence message. */
export interface LibraryPassageRecord extends LibraryRecordBase {
  kind: 'passage';
  productId?: string;
  propertyId?: string;
}

export type LibraryRecord = LibraryValueRecord | LibraryPassageRecord;

// --- The reasoner's proposal --------------------------------------------------
// A draft is a proposal, not an answer. Values appear only as references to
// library records (the boundary invariant, structural): claims carry ids and
// nothing else, and the free-text fields (interpretation, commentary) render as
// the assistant's own words, visibly separated from evidence by the UI.

export type DraftOutcome = 'answer' | 'clarify' | 'refuse';

/** A lay term translated explicitly — proposed by the assistant, editable in the UI. */
export interface LayTranslation {
  /** The term as the user said it, e.g. 'ergonomic'. */
  layTerm: string;
  /** The explicit reading, e.g. 'adjustable seat height + lumbar support'. */
  explicitTerm: string;
}

/** Part 1 of the answer — what was understood, marked as the assistant's and editable. */
export interface Interpretation {
  /** The reading in the user's own terms. */
  statement: string;
  /** Lay terms translated explicitly. */
  translations: LayTranslation[];
  /** Needs the assistant inferred beyond the words. */
  inferredNeeds: string[];
}

/** Where a requirement came from — authority is not blended (spec promise). */
export type RequirementSource =
  | { kind: 'user' }
  | { kind: 'project'; ref: string }
  | { kind: 'firm'; ref: string }
  | { kind: 'code'; ref: string }
  | { kind: 'inference'; basis: string };

/**
 * The checkable reading of a requirement — proposed by the reasoner as part of
 * its interpretation (marked as the assistant's, editable in the UI), and
 * executed — never invented — by the assertion checker. A check is the
 * requirement source's claim in machine-checkable form; it is not a value, and
 * the model has no authority to make it one. Compliance is computed by
 * comparing recorded values against this reading, or stays unknown.
 *
 * Verdict semantics, chosen so absence is never mistaken for satisfaction:
 * - `present`: a recorded value for the property meets it; none stays unknown.
 * - `absent`: any recorded value fails it; none stays unknown — absence of a
 *   proposed claim is not evidence the property is absent, so `absent` is
 *   never met on a missing claim.
 * - `raw-equals` / `raw-not-equals`: compared verbatim against the recorded
 *   raw; no recorded value stays unknown. `methodId` is the method the
 *   expectation is stated in; comparing against a value recorded under another
 *   method goes through the methods registry's comparability account.
 */
export type RequirementCheck =
  | { kind: 'present' }
  | { kind: 'absent' }
  | { kind: 'raw-equals'; raw: string; methodId?: string }
  | { kind: 'raw-not-equals'; raw: string; methodId?: string };

/** Part 2 — a requirement with its source. Firm knowledge adds requirements; it never relaxes a code (the checker enforces this). */
export interface ProposedRequirement {
  /** Canonical property id, e.g. 'flame-spread-class'. */
  propertyId: string;
  /** The requirement as the source states it. */
  statement: string;
  source: RequirementSource;
  /** The proposed checkable reading, when the requirement has one. Optional: without it the checker computes unknown. */
  check?: RequirementCheck;
}

/**
 * A candidate claim: a reference to a library record — the ONLY payload. A
 * claim carries no value, quote or product name; the checker resolves the id
 * and computes meet/fail/unknown from the record's recorded evidence.
 */
export interface ProposedClaim {
  recordId: string;
}

export interface ProposedCandidate {
  productId: string;
  claims: ProposedClaim[];
}

/** not-found and search-failed are distinct outcomes, both reported — unknown never implies the property is absent. */
export type UnknownStatus = 'not-found' | 'search-failed';

/** Part 5 — what is unknown, and what would resolve it. */
export interface ProposedUnknown {
  /** Canonical property id, or '*' when the whole question lacks support. */
  propertyId: string;
  status: UnknownStatus;
  /** Why it is unknown — never empty. */
  reason: string;
  /** What would resolve it: a document to obtain, a question to ask, a search to retry. */
  wouldResolve: string;
}

/** One named reading of an ambiguity, with what choosing it would change. */
export interface ClarifyReading {
  reading: string;
  whatItWouldChange: string;
}

/** The question back (outcome 'clarify'): the ambiguity named; no answer until a reading is chosen. */
export interface QuestionBack {
  ambiguity: string;
  readings: ClarifyReading[];
}

/**
 * Why an answer is not possible. 'not-found' and 'search-failed' are the
 * library's answers (the search ran or did not); 'unresolvable' is the
 * adapter's — a model reply that could not be turned into library references.
 */
export type RefusalStatus = UnknownStatus | 'unresolvable';

export interface Refusal {
  status: RefusalStatus;
  /** Plain reason — why no answer is possible. */
  reason: string;
}

/**
 * The reasoner's proposal. Produced by the reasoner (or its scripted fake);
 * assembled into a checked answer only by the assertion checker.
 */
export interface AnswerDraft {
  outcome: DraftOutcome;
  /** Part 1 — interpretations, each the assistant's own and editable. */
  interpretation: Interpretation[];
  /** Part 2 — requirements with their sources. */
  requirements: ProposedRequirement[];
  /** Part 3 — candidates whose claims are library references. */
  candidates: ProposedCandidate[];
  /** Part 4 — the assistant's own words, visibly separated from evidence. */
  commentary: string[];
  /** Part 5 — unknowns with what would resolve them. */
  unknowns: ProposedUnknown[];
  /** Present when outcome is 'clarify'. */
  questionBack?: QuestionBack;
  /** Present when outcome is 'refuse'. */
  refusal?: Refusal;
}

// --- The reasoner interface ---------------------------------------------------
// The model (or its scripted fake) sits behind this interface. The reasoner has
// one tool, library search (see ./search); its output is an AnswerDraft — a
// proposal the checker may accept, reject, or strip to unknown.

export interface ReasonerInput {
  /** The question exactly as the user asked it — the office's own words. */
  question: string;
}

export interface Reasoner {
  /** Stable engine name, e.g. 'fake-reasoner' — appears in harness results. */
  readonly name: string;
  answer(input: ReasonerInput): Promise<AnswerDraft>;
}

// --- Shared draft builders ----------------------------------------------------
// Refusals keep the six-part shape: what was understood, nothing asserted, why
// the answer stops, and (for search failures) the unknown rows that report the
// failed search as its own outcome.

export function refusalDraft(
  question: string,
  refusal: Refusal,
  unknowns: ProposedUnknown[] = []
): AnswerDraft {
  return {
    outcome: 'refuse',
    interpretation: [
      {
        statement: `Understood the question as asked: "${question}".`,
        translations: [],
        inferredNeeds: [],
      },
    ],
    requirements: [],
    candidates: [],
    commentary: [],
    unknowns,
    refusal,
  };
}
