// Resolution tests — the boundary invariant at the reading half (spec
// art_Ene8eA8R): any malformed piece of the draft or of a library record
// survives by becoming an unknown with a reason and what would resolve it,
// never by asserting. The thesis is tested by enumeration: every field is
// corrupted and nothing corrupted reaches the answer as a value.

import { describe, expect, it } from 'vitest';
import type { LibraryPassageRecord, LibraryRecord, LibraryValueRecord } from '@/lib/reasoner/types';
import { readDraft, resolveCandidate, validateRecord } from './resolve';

const valueRecord: LibraryValueRecord = {
  id: 'rec-1',
  kind: 'value',
  productId: 'halden-task-chair',
  propertyId: 'fire-rating',
  raw: 'class B-s1,d0',
  methodId: 'en-13501-1:2018',
  documentId: 'doc-halden-spec',
  documentTitle: 'Halden task chair — technical data sheet',
  locator: 'p. 4, §2.1',
  quote: 'Fire classification: B-s1,d0 per EN 13501-1',
  authority: 'product-doc',
  verification: 'human-verified',
  verifiedBy: 'A. Designer',
};

describe('validateRecord — a value without its evidence cannot be a record', () => {
  it('accepts a complete value record', () => {
    const validation = validateRecord(valueRecord);
    expect(validation.ok).toBe(true);
    if (validation.ok) expect(validation.record.kind).toBe('value');
  });

  it.each([
    ['documentId', { ...valueRecord, documentId: '' }],
    ['documentTitle', { ...valueRecord, documentTitle: '   ' }],
    ['locator', { ...valueRecord, locator: undefined }],
    ['quote', { ...valueRecord, quote: '' }],
    ['productId', { ...valueRecord, productId: null }],
    ['propertyId', { ...valueRecord, propertyId: 42 }],
    ['raw', { ...valueRecord, raw: '   ' }],
    ['methodId', { ...valueRecord, methodId: undefined }],
    ['authority', { ...valueRecord, authority: 'vendor-brochure' }],
    ['verification', { ...valueRecord, verification: 'definitely-checked' }],
    [
      'verifiedBy on a machine-read record',
      { ...valueRecord, verification: 'machine-read', verifiedBy: 'A. Designer' },
    ],
    [
      'human-verified without a verifier',
      { ...valueRecord, verification: 'human-verified', verifiedBy: undefined },
    ],
  ])('rejects a value with unreadable %s', (_label, broken) => {
    const result = validateRecord(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.length).toBeGreaterThan(0);
  });

  it('rejects non-objects and unknown kinds', () => {
    expect(validateRecord(null).ok).toBe(false);
    expect(validateRecord('rec-1').ok).toBe(false);
    expect(validateRecord({ kind: 'table' }).ok).toBe(false);
  });

  it('accepts a passage — and carries no value out of it', () => {
    const passage = {
      kind: 'passage',
      documentId: 'doc-ibc',
      documentTitle: 'IBC 2024',
      locator: '§10.3.2',
      quote: 'Interior finishes shall be Class B or better.',
      authority: 'code',
      verification: 'interpreted',
    };
    const validation = validateRecord(passage);
    expect(validation.ok).toBe(true);
    if (validation.ok) {
      expect(validation.record.kind).toBe('passage');
      expect('raw' in validation.record).toBe(false);
    }
  });
});

describe('readDraft — malformed pieces survive as unknowns', () => {
  const goodDraft = {
    outcome: 'answer',
    interpretation: [
      { statement: 'task chairs for seated desk work', translations: [], inferredNeeds: [] },
    ],
    requirements: [
      {
        propertyId: 'fire-rating',
        statement: 'flame-spread class B or better',
        source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      },
    ],
    candidates: [
      {
        productId: 'halden-task-chair',
        claims: [{ recordId: 'rec-1' }, { recordId: 'rec-1' }],
      },
    ],
    commentary: ['Two candidates lack a flame-spread entry.'],
    unknowns: [
      {
        propertyId: 'fire-rating',
        status: 'not-found',
        reason: 'no entry',
        wouldResolve: 'the certificate',
      },
    ],
  };

  it('reads a well-formed draft intact, deduplicating claims', () => {
    const draft = readDraft(goodDraft);
    expect(draft.outcome).toBe('answer');
    expect(draft.requirements).toHaveLength(1);
    expect(draft.candidates[0]?.claims).toEqual(['rec-1']);
    expect(draft.unknowns).toHaveLength(1);
  });

  it('a draft that is not an object refuses, and asserts nothing', () => {
    for (const junk of [null, undefined, 'answer', 42, [], true]) {
      const draft = readDraft(junk);
      expect(draft.outcome).toBe('refuse');
      expect(draft.candidates).toHaveLength(0);
      expect(draft.requirements).toHaveLength(0);
      expect(draft.refusal?.reason.length).toBeGreaterThan(0);
      expect(draft.unknowns.every((u) => u.reason.length > 0 && u.wouldResolve.length > 0)).toBe(
        true
      );
    }
  });

  it('an unreadable outcome refuses — nothing may be asserted', () => {
    const draft = readDraft({ ...goodDraft, outcome: 'sure-thing' });
    expect(draft.outcome).toBe('refuse');
    expect(draft.requirements).toHaveLength(0);
    expect(draft.unknowns.some((u) => u.reason.includes("'sure-thing'"))).toBe(true);
  });

  it('a malformed requirement becomes an unknown, not a judgment', () => {
    const draft = readDraft({
      ...goodDraft,
      requirements: [{ statement: 'no property, no source' }, 'just a string', 7],
    });
    expect(draft.requirements).toHaveLength(0);
    // goodDraft carries one unknown of its own; the three malformed requirements add three more.
    const unreadable = draft.unknowns.filter((u) => u.status === 'unreadable');
    expect(unreadable).toHaveLength(3);
    expect(unreadable.every((u) => u.recordId === undefined)).toBe(true);
  });

  it('a malformed check keeps the requirement and strips only the check', () => {
    const draft = readDraft({
      ...goodDraft,
      requirements: [
        {
          propertyId: 'fire-rating',
          statement: 'flame-spread class B or better',
          source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
          check: { kind: 'at-least', raw: 'B' },
        },
      ],
    });
    expect(draft.requirements).toHaveLength(1);
    expect(draft.requirements[0]?.check).toBeUndefined();
    expect(draft.unknowns.some((u) => u.reason.includes('could not be read'))).toBe(true);
  });

  it('a candidate without a product cannot attribute its claims', () => {
    const draft = readDraft({
      ...goodDraft,
      candidates: [{ productId: '', claims: [{ recordId: 'rec-1' }] }],
    });
    expect(draft.candidates).toHaveLength(0);
    expect(draft.unknowns.filter((u) => u.recordId === 'rec-1')).toHaveLength(1);
  });

  it('unreadable claims and malformed candidates become unknowns', () => {
    const draft = readDraft({
      ...goodDraft,
      candidates: [{ productId: 'halden-task-chair', claims: [{ recordId: '' }, 'rec-1', 3] }, 9],
    });
    expect(draft.candidates).toHaveLength(1);
    expect(draft.candidates[0]?.claims).toHaveLength(0);
    expect(draft.unknowns.length).toBeGreaterThanOrEqual(4);
  });

  it('a draft unknown with a made-up status is rewritten, not carried', () => {
    const draft = readDraft({
      ...goodDraft,
      unknowns: [{ propertyId: 'fire-rating', status: 'met-actually', reason: 'trust me' }],
    });
    expect(draft.unknowns[0]?.status).toBe('unreadable');
    expect(draft.unknowns[0]?.reason).toContain('not a search outcome');
  });

  it('a clarify without a named ambiguity says so instead of inventing readings', () => {
    const draft = readDraft({
      ...goodDraft,
      outcome: 'clarify',
      questionBack: { ambiguity: '   ', readings: [] },
    });
    expect(draft.questionBack?.ambiguity).toContain('did not name the ambiguity');
  });

  it('a refusal without a reason gets the honest default', () => {
    const draft = readDraft({
      ...goodDraft,
      outcome: 'refuse',
      refusal: { status: 'not-found', reason: '' },
    });
    expect(draft.refusal?.status).toBe('unresolvable');
    expect(draft.refusal?.reason).toContain('without stating its reason');
  });

  it('candidates proposed on a non-answer outcome are not read', () => {
    const draft = readDraft({ ...goodDraft, outcome: 'clarify' });
    expect(draft.candidates).toHaveLength(0);
  });
});

describe('resolveCandidate — attribution is checked, never trusted', () => {
  const candidate = { productId: 'halden-task-chair', claims: ['rec-1'] };

  it('resolves a claim to an attributable validated value', () => {
    const { resolved, stripped } = resolveCandidate(candidate, new Map([['rec-1', valueRecord]]));
    expect(stripped).toHaveLength(0);
    expect(resolved.values).toHaveLength(1);
    expect(resolved.values[0]?.kind).toBe('value');
    expect(resolved.values[0]?.id).toBe('rec-1');
  });

  it('a missing record becomes unresolved-ref with what would resolve it', () => {
    const { stripped } = resolveCandidate(candidate, new Map());
    expect(stripped).toHaveLength(1);
    expect(stripped[0]?.status).toBe('unresolved-ref');
    expect(stripped[0]?.reason).toContain('rec-1');
    expect(stripped[0]?.wouldResolve.length).toBeGreaterThan(0);
  });

  it('an invisible record is indistinguishable from a missing one', () => {
    const { stripped } = resolveCandidate(candidate, new Map([['rec-1', null]]));
    expect(stripped[0]?.status).toBe('unresolved-ref');
  });

  it('a corrupted record becomes unreadable — the corruption does not ride through', () => {
    // null is not here: an absent or invisible record is 'unresolved-ref' —
    // unreadable is for a record that exists but cannot be trusted.
    // The cast is the point: the port's type promises records, but runtime
    // data can be anything — the validator is what stands between.
    for (const broken of [{ kind: 'value' }, { ...valueRecord, verification: 'nope' }]) {
      const { stripped } = resolveCandidate(
        candidate,
        new Map<string, LibraryRecord | null>([['rec-1', broken as unknown as LibraryRecord]])
      );
      expect(stripped).toHaveLength(1);
      expect(stripped[0]?.status).toBe('unreadable');
    }
  });

  it('a passage is source text, not a value — nobody has read a value out of it', () => {
    const passage: LibraryPassageRecord = {
      id: 'rec-1',
      kind: 'passage',
      documentId: 'doc-ibc',
      documentTitle: 'IBC 2024',
      locator: '§10.3.2',
      quote: 'Class B or better.',
      authority: 'code',
      verification: 'interpreted',
    };
    const { stripped } = resolveCandidate(candidate, new Map([['rec-1', passage]]));
    expect(stripped[0]?.status).toBe('not-a-value');
    expect(stripped[0]?.reason).toContain('not a recorded value');
  });

  it('another product’s value is unattributable — a draft cannot re-attribute evidence', () => {
    const other = { ...valueRecord, productId: 'mera-conference' };
    const { resolved, stripped } = resolveCandidate(candidate, new Map([['rec-1', other]]));
    expect(resolved.values).toHaveLength(0);
    expect(stripped[0]?.status).toBe('unattributable');
    expect(stripped[0]?.reason).toContain('mera-conference');
  });
});
