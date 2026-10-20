// Resolution — the reading half of the assertion checker (spec art_Ene8eA8R,
// "Two authorities"). A draft arrives from a model adapter: whatever its TypeScript
// says, its runtime shape is untrusted, so every field is validated here before
// anything downstream sees it.
//
// The invariant this module serves is the boundary invariant: any malformed
// piece — of the draft, or of a library record — survives by becoming an
// unknown with a reason and what would resolve it, never by asserting. Nothing
// a malformed draft carries reaches the answer as a value.

import type {
  Authority,
  Interpretation,
  LibraryPassageRecord,
  LibraryRecord,
  LibraryValueRecord,
  QuestionBack,
  Refusal,
  RefusalStatus,
  RequirementCheck,
  RequirementSource,
  VerificationState,
} from '@/lib/reasoner/types';
import type { CheckedRequirement, CheckedUnknown } from './types';

// --- Runtime validators -------------------------------------------------------

/** A non-empty string, trimmed — for ids, slugs and names. */
function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/** A non-blank string kept verbatim — for quotes and raws, where verbatim means verbatim. */
function nonBlankString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/** Optional non-empty string or explicit absence (null is treated as absent — this is JSON's job). */
function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : nonEmptyString(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Render an arbitrary runtime value for a reason string — bounded, never thrown. */
function display(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`;
  if (value === undefined) return 'missing';
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'an unreadable value';
}

// --- Library-record validation ------------------------------------------------

const AUTHORITIES: readonly Authority[] = ['product-doc', 'code', 'project', 'correspondence'];
const VERIFICATIONS: readonly VerificationState[] = [
  'human-verified',
  'interpreted',
  'machine-read',
];
const OUTCOMES: readonly string[] = ['answer', 'clarify', 'refuse'];
const REFUSAL_STATUSES: readonly RefusalStatus[] = ['not-found', 'search-failed', 'unresolvable'];

/** Type guards over the closed sets — validation narrows, it never casts. */
function isAuthority(value: unknown): value is Authority {
  return typeof value === 'string' && (AUTHORITIES as readonly string[]).includes(value);
}

function isVerification(value: unknown): value is VerificationState {
  return typeof value === 'string' && (VERIFICATIONS as readonly string[]).includes(value);
}

function isRefusalStatus(value: unknown): value is RefusalStatus {
  return typeof value === 'string' && (REFUSAL_STATUSES as readonly string[]).includes(value);
}

function isOutcome(value: unknown): value is 'answer' | 'clarify' | 'refuse' {
  return typeof value === 'string' && (OUTCOMES as readonly string[]).includes(value);
}

export type RecordValidation = { ok: true; record: LibraryRecord } | { ok: false; why: string };

/**
 * Validate a library record as recorded. Only the known fields are carried
 * into the validated record — anything smuggled alongside is inert by
 * construction, because the validated object is what the checker ever sees.
 * The record's `id` is filled by the caller from the requested map key.
 */
export function validateRecord(raw: unknown): RecordValidation {
  if (!isObject(raw)) {
    return { ok: false, why: 'the record is not an object' };
  }
  const kind = raw['kind'];
  if (kind !== 'value' && kind !== 'passage') {
    return { ok: false, why: `the record's kind is ${display(kind)}, not 'value' or 'passage'` };
  }
  const documentId = nonEmptyString(raw['documentId']);
  const documentTitle = nonBlankString(raw['documentTitle']);
  const locator = nonEmptyString(raw['locator']);
  const quote = nonBlankString(raw['quote']);
  const authority = raw['authority'];
  const verification = raw['verification'];
  if (documentId === undefined) return { ok: false, why: 'the record has no document id' };
  if (documentTitle === undefined) return { ok: false, why: 'the record has no document title' };
  if (locator === undefined)
    return { ok: false, why: 'the record has no locator — its evidence has no place' };
  if (quote === undefined)
    return { ok: false, why: 'the record has no verbatim quote — it cannot be evidence' };
  if (!isAuthority(authority)) {
    return { ok: false, why: `the record's authority is ${display(authority)}` };
  }
  if (!isVerification(verification)) {
    return { ok: false, why: `the record's verification state is ${display(verification)}` };
  }
  const verifiedBy = optionalString(raw['verifiedBy']);
  if (verification === 'human-verified' && verifiedBy === undefined) {
    return { ok: false, why: 'a human-verified record must name who verified it' };
  }
  if (verification !== 'human-verified' && verifiedBy !== undefined) {
    return { ok: false, why: 'only a human-verified record may name a verifier' };
  }
  const common = {
    documentId,
    documentTitle,
    locator,
    quote,
    authority,
    verification,
    ...(verifiedBy !== undefined ? { verifiedBy } : {}),
  } as const;
  if (kind === 'value') {
    const productId = nonEmptyString(raw['productId']);
    const propertyId = nonEmptyString(raw['propertyId']);
    const rawValue = nonBlankString(raw['raw']);
    const methodId = nonEmptyString(raw['methodId']);
    if (productId === undefined) {
      return {
        ok: false,
        why: 'the value does not record which product it belongs to — attribution cannot be checked',
      };
    }
    if (propertyId === undefined) {
      return { ok: false, why: 'the value does not record which property it is a value of' };
    }
    if (rawValue === undefined) {
      return { ok: false, why: 'the value carries no raw value as the source words it' };
    }
    if (methodId === undefined) {
      return {
        ok: false,
        why: 'the value does not record the method it was measured or classified under',
      };
    }
    const record: LibraryValueRecord = {
      id: '',
      kind: 'value',
      productId,
      propertyId,
      raw: rawValue,
      methodId,
      ...common,
    };
    return { ok: true, record };
  }
  const passageProductId = optionalString(raw['productId']);
  const passagePropertyId = optionalString(raw['propertyId']);
  const record: LibraryPassageRecord = {
    id: '',
    kind: 'passage',
    ...(passageProductId !== undefined ? { productId: passageProductId } : {}),
    ...(passagePropertyId !== undefined ? { propertyId: passagePropertyId } : {}),
    ...common,
  };
  return { ok: true, record };
}

// --- Requirement validation ---------------------------------------------------

const CHECK_KINDS: ReadonlySet<string> = new Set([
  'present',
  'absent',
  'raw-equals',
  'raw-not-equals',
]);

/**
 * Validate a proposed check. A malformed check throws nothing — the caller
 * keeps the requirement and records an unknown, because compliance without a
 * readable check is unknown, never judged.
 */
export function validateCheck(raw: unknown): { check?: RequirementCheck; malformed: boolean } {
  if (raw === undefined || raw === null) {
    return { malformed: false };
  }
  if (!isObject(raw) || typeof raw['kind'] !== 'string' || !CHECK_KINDS.has(raw['kind'])) {
    return { malformed: true };
  }
  const kind = raw['kind'];
  if (kind === 'present' || kind === 'absent') {
    return { check: { kind }, malformed: false };
  }
  const expected = nonBlankString(raw['raw']);
  if (expected === undefined) {
    return { malformed: true };
  }
  const methodId = optionalString(raw['methodId']);
  return kind === 'raw-equals'
    ? {
        check: {
          kind: 'raw-equals',
          raw: expected,
          ...(methodId !== undefined ? { methodId } : {}),
        },
        malformed: false,
      }
    : {
        check: {
          kind: 'raw-not-equals',
          raw: expected,
          ...(methodId !== undefined ? { methodId } : {}),
        },
        malformed: false,
      };
}

/** Validate a requirement's source. Sources are closed sets — authority is never blended. */
function validateSource(raw: unknown): RequirementSource | undefined {
  if (!isObject(raw)) return undefined;
  const kind = raw['kind'];
  switch (kind) {
    case 'user':
      return { kind: 'user' };
    case 'project':
    case 'firm':
    case 'code': {
      const ref = nonEmptyString(raw['ref']);
      return ref === undefined ? undefined : { kind, ref };
    }
    case 'inference': {
      const basis = nonEmptyString(raw['basis']);
      return basis === undefined ? undefined : { kind: 'inference', basis };
    }
    default:
      return undefined;
  }
}

// --- The draft reader ---------------------------------------------------------

/** One candidate, as the draft proposes it: a product and the references it claims. */
export interface ReadCandidate {
  productId: string;
  /** Requested record ids, trimmed and deduplicated — nothing else survives from a claim. */
  claims: string[];
}

/**
 * The draft, read. Everything is normalized here so the computation deals only
 * with well-formed pieces plus a pile of unknowns. Interpretation and
 * commentary are the assistant's own words — they carry no evidence, so their
 * malformed entries are dropped rather than converted to unknowns; every
 * evidence-bearing piece (requirements, claims, unknowns) strips to an unknown
 * row instead.
 */
export interface ReadDraft {
  outcome: 'answer' | 'clarify' | 'refuse';
  interpretation: Interpretation[];
  requirements: CheckedRequirement[];
  candidates: ReadCandidate[];
  commentary: string[];
  unknowns: CheckedUnknown[];
  questionBack?: QuestionBack;
  refusal?: Refusal;
}

function readInterpretation(raw: unknown): Interpretation[] {
  if (!Array.isArray(raw)) return [];
  const read: Interpretation[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const statement = nonBlankString(entry['statement']);
    if (statement === undefined) continue;
    const translations: Interpretation['translations'] = [];
    if (Array.isArray(entry['translations'])) {
      for (const t of entry['translations']) {
        if (!isObject(t)) continue;
        const layTerm = nonEmptyString(t['layTerm']);
        const explicitTerm = nonEmptyString(t['explicitTerm']);
        if (layTerm !== undefined && explicitTerm !== undefined) {
          translations.push({ layTerm, explicitTerm });
        }
      }
    }
    const inferredNeeds = Array.isArray(entry['inferredNeeds'])
      ? entry['inferredNeeds']
          .filter((need): need is string => typeof need === 'string' && need.trim() !== '')
          .map((need) => need.trim())
      : [];
    read.push({ statement, translations, inferredNeeds });
  }
  return read;
}

function readRequirements(raw: unknown, unknowns: CheckedUnknown[]): CheckedRequirement[] {
  if (!Array.isArray(raw)) return [];
  const read: CheckedRequirement[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) {
      unknowns.push({
        propertyId: '*',
        status: 'unreadable',
        reason: 'a proposed requirement could not be read — it is not an object',
        wouldResolve:
          're-state the requirement with its property, statement and source, then re-run',
      });
      continue;
    }
    const propertyId = nonEmptyString(entry['propertyId']);
    const statement = nonBlankString(entry['statement']);
    const source = validateSource(entry['source']);
    if (propertyId === undefined || statement === undefined || source === undefined) {
      unknowns.push({
        propertyId: propertyId ?? '*',
        status: 'unreadable',
        reason:
          'a proposed requirement could not be read — it needs a property, a statement and a source',
        wouldResolve:
          're-state the requirement with its property, statement and source, then re-run',
      });
      continue;
    }
    const proposedCheck = validateCheck(entry['check']);
    if (proposedCheck.malformed) {
      // The requirement stands; its unreadable check does not. Compliance stays
      // unknown until the check is re-stated — never guessed.
      unknowns.push({
        propertyId,
        status: 'unreadable',
        reason: `the requirement '${statement}' carries a check that could not be read — compliance stays unknown rather than judged`,
        wouldResolve:
          're-state the check as present, absent, raw-equals or raw-not-equals, then re-run',
      });
    }
    read.push({
      propertyId,
      statement,
      source,
      ...(proposedCheck.check !== undefined ? { check: proposedCheck.check } : {}),
    });
  }
  return read;
}

function readCandidates(raw: unknown, unknowns: CheckedUnknown[]): ReadCandidate[] {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) {
      unknowns.push({
        propertyId: '*',
        status: 'unreadable',
        reason: "the draft's candidates could not be read — no candidate row can be computed",
        wouldResolve:
          're-run the reasoner so it proposes candidates as products with record references',
      });
    }
    return [];
  }
  const read: ReadCandidate[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) {
      unknowns.push({
        propertyId: '*',
        status: 'unreadable',
        reason: 'a proposed candidate could not be read — it is not an object',
        wouldResolve: 're-state the candidate as a product with record references, then re-run',
      });
      continue;
    }
    const productId = nonEmptyString(entry['productId']);
    const claimEntries = Array.isArray(entry['claims']) ? entry['claims'] : [];
    if (productId === undefined) {
      // Without a product, nothing the candidate claims can be attributed —
      // each readable reference is stripped rather than silently dropped.
      unknowns.push({
        propertyId: '*',
        status: 'unreadable',
        reason:
          'a proposed candidate has no readable product — what it claims cannot be attributed',
        wouldResolve: 're-state the candidate with its product id, then re-run',
      });
      for (const claim of claimEntries) {
        const recordId = isObject(claim) ? nonEmptyString(claim['recordId']) : undefined;
        unknowns.push({
          propertyId: '*',
          status: 'unreadable',
          reason:
            recordId !== undefined
              ? `the candidate's reference '${recordId}' cannot be attributed — the candidate has no readable product`
              : "one of the candidate's references could not be read, and the candidate has no readable product",
          wouldResolve: 're-state the candidate with its product id, then re-run',
          ...(recordId !== undefined ? { recordId } : {}),
        });
      }
      continue;
    }
    const claims: string[] = [];
    for (const claim of claimEntries) {
      const recordId = isObject(claim) ? nonEmptyString(claim['recordId']) : undefined;
      if (recordId === undefined) {
        unknowns.push({
          propertyId: '*',
          status: 'unreadable',
          reason: `a claim of candidate '${productId}' could not be read — a claim carries only the record id it references`,
          wouldResolve: 're-state the claim as { recordId }, then re-run',
          productId,
        });
        continue;
      }
      claims.push(recordId);
    }
    read.push({ productId, claims: [...new Set(claims)] });
  }
  return read;
}

function readDraftUnknowns(raw: unknown): CheckedUnknown[] {
  if (!Array.isArray(raw)) return [];
  const read: CheckedUnknown[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) {
      read.push({
        propertyId: '*',
        status: 'unreadable',
        reason: 'the draft reported an unknown that could not be read',
        wouldResolve:
          're-run the reasoner so its unknowns carry property, status, reason and what would resolve them',
      });
      continue;
    }
    const propertyId = nonEmptyString(entry['propertyId']) ?? '*';
    const status = entry['status'];
    const reason = nonBlankString(entry['reason']);
    const wouldResolve = nonBlankString(entry['wouldResolve']);
    if (typeof status !== 'string' || !(status === 'not-found' || status === 'search-failed')) {
      // A status outside the two honest search outcomes is rewritten, not
      // carried — an unknown never wears a state the search did not produce.
      read.push({
        propertyId,
        status: 'unreadable',
        reason:
          reason !== undefined
            ? `the draft reported: ${reason} — its status was ${display(status)}, not a search outcome, so it is carried as unreadable`
            : 'the draft reported an unknown with an unreadable status and no reason',
        wouldResolve:
          wouldResolve ?? 'retry the search, or obtain the document that would settle the property',
      });
      continue;
    }
    read.push({
      propertyId,
      status,
      reason: reason ?? 'the draft reported this unknown without a reason',
      wouldResolve:
        wouldResolve ??
        'no resolution named — a document to obtain, a question to ask, or a search to retry would resolve it',
    });
  }
  return read;
}

function readQuestionBack(raw: unknown): QuestionBack | undefined {
  if (!isObject(raw)) return undefined;
  const ambiguity = nonBlankString(raw['ambiguity']);
  if (ambiguity === undefined) return undefined;
  const readings: QuestionBack['readings'] = [];
  if (Array.isArray(raw['readings'])) {
    for (const entry of raw['readings']) {
      if (!isObject(entry)) continue;
      const reading = nonBlankString(entry['reading']);
      const whatItWouldChange = nonBlankString(entry['whatItWouldChange']);
      if (reading !== undefined && whatItWouldChange !== undefined) {
        readings.push({ reading, whatItWouldChange });
      }
    }
  }
  return { ambiguity, readings };
}

function readRefusal(raw: unknown): Refusal | undefined {
  if (!isObject(raw)) return undefined;
  const status = raw['status'];
  const reason = nonBlankString(raw['reason']);
  if (!isRefusalStatus(status) || reason === undefined) {
    return undefined;
  }
  return { status, reason };
}

/** Read an arbitrary runtime value as a draft — total, deterministic, never throwing. */
export function readDraft(raw: unknown): ReadDraft {
  if (!isObject(raw)) {
    return {
      outcome: 'refuse',
      interpretation: [],
      requirements: [],
      candidates: [],
      commentary: [],
      unknowns: [
        {
          propertyId: '*',
          status: 'unreadable',
          reason: 'the draft could not be read at all — nothing can be asserted from it',
          wouldResolve: 're-run the reasoner so it returns a well-formed draft',
        },
      ],
      refusal: {
        status: 'unresolvable',
        reason:
          'the draft could not be read at all — no answer, question back, or refusal survived',
      },
    };
  }
  const unknowns: CheckedUnknown[] = readDraftUnknowns(raw['unknowns']);
  const outcome = raw['outcome'];
  if (!isOutcome(outcome)) {
    // The outcome governs what may be asserted; an unreadable outcome means
    // nothing may be. The draft refuses, and its reason says exactly why.
    return {
      outcome: 'refuse',
      interpretation: readInterpretation(raw['interpretation']),
      requirements: [],
      candidates: [],
      commentary: [],
      unknowns: [
        ...unknowns,
        {
          propertyId: '*',
          status: 'unreadable',
          reason: `the draft's outcome is ${display(outcome)} — not an answer, a question back, or a refusal`,
          wouldResolve: 're-run the reasoner so it returns a well-formed outcome',
        },
      ],
      refusal: {
        status: 'unresolvable',
        reason: "the draft's outcome could not be read — nothing can be asserted from it",
      },
    };
  }
  const read: ReadDraft = {
    outcome,
    interpretation: readInterpretation(raw['interpretation']),
    requirements: readRequirements(raw['requirements'], unknowns),
    candidates: outcome === 'answer' ? readCandidates(raw['candidates'], unknowns) : [],
    commentary: Array.isArray(raw['commentary'])
      ? raw['commentary']
          .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
          .map((line) => line.trim())
      : [],
    unknowns,
  };
  if (outcome === 'clarify') {
    const questionBack = readQuestionBack(raw['questionBack']);
    read.questionBack = questionBack ??
      // A question back must name the ambiguity; when the draft names none, the
      // checker says so rather than inventing readings.
      { ambiguity: 'the draft asked a question back but did not name the ambiguity', readings: [] };
  }
  if (outcome === 'refuse') {
    read.refusal = readRefusal(raw['refusal']) ?? {
      status: 'unresolvable',
      reason: 'the draft refused without stating its reason',
    };
  }
  return read;
}

// --- Claim resolution ---------------------------------------------------------

/** One candidate's attributable, validated value records — what its compliance can be computed from. */
export interface ResolvedCandidate {
  productId: string;
  /** Value records whose recorded product is this candidate's product, in record-id order. */
  values: LibraryRecord[];
}

const byRecordId = (a: LibraryRecord, b: LibraryRecord): number => a.id.localeCompare(b.id);

/**
 * Resolve one candidate's claims against the resolved records. Every claim
 * lands somewhere: an attributable value, or an unknown with its reason and
 * what would resolve it. Attribution is checked, never trusted — the record's
 * own productId decides which candidate a value belongs to, so the draft
 * cannot attribute one product's evidence to another.
 */
export function resolveCandidate(
  candidate: ReadCandidate,
  records: ReadonlyMap<string, LibraryRecord | null>
): { resolved: ResolvedCandidate; stripped: CheckedUnknown[] } {
  const values: LibraryRecord[] = [];
  const stripped: CheckedUnknown[] = [];
  for (const recordId of candidate.claims) {
    const unresolved: CheckedUnknown = {
      propertyId: '*',
      status: 'unresolved-ref',
      reason: `no library record answers the reference '${recordId}' — it does not exist, or it is not visible to you`,
      wouldResolve:
        'reference a record the library search returned, or add the record to the library',
      productId: candidate.productId,
      recordId,
    };
    const resolved = records.get(recordId);
    if (resolved === undefined || resolved === null) {
      stripped.push(unresolved);
      continue;
    }
    const validation = validateRecord(resolved);
    if (!validation.ok) {
      stripped.push({
        ...unresolved,
        status: 'unreadable',
        reason: `the referenced record '${recordId}' could not be used — ${validation.why}`,
        wouldResolve:
          'repair the library record so it carries its document, locator, verbatim quote, verification state and — for a value — its product, property, raw and method',
      });
      continue;
    }
    const record = { ...validation.record, id: recordId };
    if (record.kind === 'passage') {
      stripped.push({
        ...unresolved,
        status: 'not-a-value',
        reason: `the referenced record '${recordId}' is source text at ${record.locator}, not a recorded value — nobody has read a value out of it yet`,
        wouldResolve:
          'read the passage and record the value it supports, with its method, authority and verification state',
      });
      continue;
    }
    if (record.productId !== candidate.productId) {
      stripped.push({
        ...unresolved,
        status: 'unattributable',
        reason: `the referenced record '${recordId}' belongs to '${record.productId}', not '${candidate.productId}' — a value cannot be attributed to another product`,
        wouldResolve: `reference a record recorded for '${candidate.productId}', or correct the candidate's product`,
      });
      continue;
    }
    values.push(record);
  }
  return {
    resolved: { productId: candidate.productId, values: values.sort(byRecordId) },
    stripped,
  };
}
