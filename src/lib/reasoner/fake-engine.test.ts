// Contract tests for the scripted fake engine: deterministic output, and the
// acceptance-criteria invariant — every claim in a produced draft resolves to a
// library record via the search tool. Drafts reference library ids only.

import { describe, expect, test } from 'vitest';
import { FakeReasoner } from './fake-engine';
import type { ScriptedCase } from './fake-engine';
import { FakeLibrarySearch } from './search';
import { makeValueRecord } from './test-fixtures';
import type { AnswerDraft } from './types';

const library = new FakeLibrarySearch([
  makeValueRecord({ id: 'rec-halden-seat-height' }),
  makeValueRecord({
    id: 'rec-halden-lumbar',
    propertyId: 'lumbar-support',
    raw: 'Adjustable lumbar support',
    quote: 'Height- and depth-adjustable lumbar support.',
    locator: 'p. 5, §2.4',
  }),
]);

const scriptedDraft: AnswerDraft = {
  outcome: 'answer',
  interpretation: [
    {
      statement: 'Task chairs for seated desk work.',
      translations: [
        { layTerm: 'ergonomic', explicitTerm: 'adjustable seat height + lumbar support' },
      ],
      inferredNeeds: [],
    },
  ],
  requirements: [
    {
      propertyId: 'seat-height-adjustable',
      statement: 'Seat height adjustable',
      source: { kind: 'inference', basis: 'from "task chairs"' },
    },
  ],
  candidates: [
    {
      productId: 'halden-task-chair',
      claims: [{ recordId: 'rec-halden-seat-height' }, { recordId: 'rec-halden-lumbar' }],
    },
  ],
  commentary: ['Proposed from what the library holds; compliance is computed downstream.'],
  unknowns: [],
};

const script: ScriptedCase[] = [{ question: 'show me task chairs', draft: scriptedDraft }];

describe('FakeReasoner — the provider-free stand-in', () => {
  test('a scripted question returns its draft verbatim, deterministically', async () => {
    const reasoner = new FakeReasoner(script);
    const first = await reasoner.answer({ question: 'show me task chairs' });
    const second = await reasoner.answer({ question: 'show me task chairs' });
    expect(first).toEqual(scriptedDraft);
    expect(first).toEqual(second);
  });

  test('CONTRACT: every claim resolves to a library record — drafts reference library ids only', async () => {
    const reasoner = new FakeReasoner(script);
    const draft = await reasoner.answer({ question: 'show me task chairs' });
    const allRecords = (await library.search({ terms: '' })).records;
    for (const candidate of draft.candidates) {
      for (const claim of candidate.claims) {
        const record = allRecords.find((entry) => entry.id === claim.recordId);
        expect(record, `claim ${claim.recordId} must resolve to a library record`).toBeDefined();
        expect(record?.productId).toBe(candidate.productId);
      }
    }
  });

  test('an unscripted question refuses with its reason — ask and stop rather than guess', async () => {
    const draft = await new FakeReasoner(script).answer({
      question: 'lighting for the conference room',
    });
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.reason).toBeTruthy();
    expect(draft.candidates).toEqual([]);
    expect(draft.unknowns[0]?.status).toBe('not-found');
    expect(draft.unknowns[0]?.reason).toBeTruthy();
    expect(draft.unknowns[0]?.wouldResolve).toBeTruthy();
  });

  test('it implements the Reasoner interface with a stable name', () => {
    expect(new FakeReasoner(script).name).toBe('fake-reasoner');
  });
});
