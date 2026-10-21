// Provider-run plumbing — the pure mappings the recorded run stands on. The
// run itself is evidence, not a gate; these tests keep its plumbing honest:
// drafts lose nothing the graders need, and the seed the reasoner searches is
// the same synthetic library the scripted gate grades against.

import { describe, expect, it } from 'vitest';
import { FakeLibrarySearch } from '@/lib/reasoner/search';
import type {
  AnswerDraft as ReasonerAnswerDraft,
  ProposedCandidate as ReasonerCandidate,
  ProposedUnknown as ReasonerUnknown,
} from '@/lib/reasoner/types';
import { SCRIPTED_LIBRARY } from './fixtures';
import { providerLibrarySeed, toEvalDraft } from './provider-run';

const reasonerUnknown = (over: Partial<ReasonerUnknown>): ReasonerUnknown => ({
  propertyId: 'flame-spread',
  status: 'not-found',
  reason: 'No entry in the library.',
  wouldResolve: "The manufacturer's fire certificate.",
  ...over,
});

const reasonerCandidate = (over: Partial<ReasonerCandidate>): ReasonerCandidate => ({
  productId: 'halden-task-chair',
  claims: [{ recordId: 'rec-halden-seat-height' }],
  ...over,
});

describe('toEvalDraft', () => {
  it('maps an answer draft — candidates as bare references, unknowns with status', () => {
    const draft: ReasonerAnswerDraft = {
      outcome: 'answer',
      interpretation: [],
      requirements: [],
      commentary: [],
      candidates: [reasonerCandidate({}), reasonerCandidate({ productId: 'vind-desk-chair' })],
      unknowns: [
        reasonerUnknown({}),
        reasonerUnknown({ propertyId: 'flame-spread', status: 'search-failed' }),
      ],
    };
    const mapped = toEvalDraft(draft);
    expect(mapped.outcome).toBe('answer');
    expect(mapped.candidates).toEqual([
      { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
      { productId: 'vind-desk-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
    ]);
    expect(mapped.unknowns).toEqual([
      { propertyId: 'flame-spread', reason: 'No entry in the library.', status: 'not-found' },
      { propertyId: 'flame-spread', reason: 'No entry in the library.', status: 'search-failed' },
    ]);
    expect(mapped.readings).toBeUndefined();
    expect(mapped.refusalReason).toBeUndefined();
  });

  it('lifts the question-back readings and the refusal reason', () => {
    const clarify: ReasonerAnswerDraft = {
      outcome: 'clarify',
      interpretation: [],
      requirements: [],
      commentary: [],
      candidates: [],
      unknowns: [],
      questionBack: {
        ambiguity: '“quiet” names three needs',
        readings: [
          { reading: 'sound isolation between rooms', whatItWouldChange: 'which products fit' },
          { reading: 'reverberation control', whatItWouldChange: 'absorption class' },
        ],
      },
    };
    expect(toEvalDraft(clarify).readings).toEqual([
      'sound isolation between rooms',
      'reverberation control',
    ]);

    const refuse: ReasonerAnswerDraft = {
      outcome: 'refuse',
      interpretation: [],
      requirements: [],
      commentary: [],
      candidates: [],
      unknowns: [],
      refusal: { status: 'not-found', reason: 'No pricing exists in the library.' },
    };
    expect(toEvalDraft(refuse).refusalReason).toBe('No pricing exists in the library.');
  });
});

describe('providerLibrarySeed', () => {
  it('maps every scripted record to a well-formed searchable value record', async () => {
    const seed = providerLibrarySeed();
    expect(seed.length).toBe(Object.keys(SCRIPTED_LIBRARY).length);

    for (const record of seed) {
      expect(record.kind).toBe('value');
      expect(record.authority).toBe('product-doc');
      expect(record.documentId.trim()).not.toBe('');
      expect(record.documentTitle.trim()).not.toBe('');
      expect(record.locator.trim()).not.toBe('');
      expect(record.quote.trim()).not.toBe('');
      expect(record.raw).toBe(record.quote);
      expect(record.productId).toBeTruthy();
      expect(record.propertyId).toBeTruthy();
      if (record.verification === 'human-verified') {
        expect(record.verifiedBy).toBeTruthy();
      }
    }

    // The seed must actually answer the reasoner's one tool — a property-term
    // search over the fixture library finds its record.
    const search = new FakeLibrarySearch(seed);
    const found = await search.search({ terms: 'gas lift seat height' });
    expect(found.records.some((record) => record.id === 'rec-halden-seat-height')).toBe(true);
  });
});
