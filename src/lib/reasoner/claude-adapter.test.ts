// Contract tests for the provider adapter: the key is read from env (never
// hardcoded), the adapter is skippable when no key is present, model replies
// are parsed into reference-only drafts, and failures refuse rather than guess.
// The transport is injected — no test touches the network.

import { describe, expect, test } from 'vitest';
import {
  ClaudeProviderError,
  ClaudeReasoner,
  createClaudeReasoner,
  parseModelDraft,
} from './claude-adapter';
import type { ClaudeRequest, ClaudeTransport } from './claude-adapter';
import { FakeLibrarySearch } from './search';
import { LibrarySearchError } from './search';
import type { LibrarySearchTool } from './search';
import { makeValueRecord } from './test-fixtures';

const library = new FakeLibrarySearch([makeValueRecord()]);

describe('availability gating — the API key is an injected secret', () => {
  test('no key in env: unavailable, and the reason names where it looked', () => {
    const result = createClaudeReasoner(library, {});
    expect(result.available).toBe(false);
    if (!result.available) {
      expect(result.reason).toContain('SECRET_ANTHROPIC_API_KEY');
      expect(result.reason).toContain('ANTHROPIC_API_KEY');
    }
  });

  test('a key under either name is accepted', () => {
    expect(createClaudeReasoner(library, { ANTHROPIC_API_KEY: 'test-key' }).available).toBe(true);
    expect(createClaudeReasoner(library, { SECRET_ANTHROPIC_API_KEY: 'test-key' }).available).toBe(
      true
    );
  });

  test('an empty key counts as absent', () => {
    expect(createClaudeReasoner(library, { ANTHROPIC_API_KEY: '' }).available).toBe(false);
  });
});

describe('parseModelDraft — untrusted reply in, reference-only draft out', () => {
  test('a valid reply maps into a well-formed draft', () => {
    const reply = JSON.stringify({
      outcome: 'answer',
      interpretation: [
        {
          statement: 'Seating for desk work.',
          translations: [{ layTerm: 'ergonomic', explicitTerm: 'adjustable seat height' }],
          inferredNeeds: ['lumbar support'],
        },
      ],
      requirements: [
        {
          propertyId: 'seat-height-adjustable',
          statement: 'Seat height adjustable',
          source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
        },
      ],
      candidates: [
        { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
      ],
      commentary: ['Halden fits on what the library holds.'],
      unknowns: [
        {
          propertyId: 'flame-spread-class',
          status: 'not-found',
          reason: 'No entry in the library.',
          wouldResolve: 'The fire certificate.',
        },
      ],
    });
    const { draft, coercions, droppedRecordIds } = parseModelDraft(reply, [makeValueRecord()], 'q');
    expect(coercions).toEqual([]);
    expect(droppedRecordIds).toEqual([]);
    expect(draft.outcome).toBe('answer');
    expect(draft.interpretation[0]?.translations[0]?.explicitTerm).toBe('adjustable seat height');
    expect(draft.requirements[0]?.source).toEqual({ kind: 'code', ref: 'IBC 2024 §10.3.2' });
    expect(draft.candidates[0]?.productId).toBe('halden-task-chair');
    expect(draft.unknowns[0]?.wouldResolve).toBe('The fire certificate.');
  });

  test('claims are rebuilt as bare references — a value the model attached cannot cross the boundary', () => {
    const reply = JSON.stringify({
      outcome: 'answer',
      candidates: [
        {
          productId: 'halden-task-chair',
          claims: [
            {
              recordId: 'rec-halden-seat-height',
              value: '42–55 cm',
              quote: 'Seat height adjustable 42–55 cm via gas lift.',
            },
          ],
        },
      ],
    });
    const { draft } = parseModelDraft(reply, [makeValueRecord()], 'q');
    const claim = draft.candidates[0]?.claims[0];
    expect(claim).toEqual({ recordId: 'rec-halden-seat-height' });
    expect(Object.keys(claim ?? {})).toEqual(['recordId']);
  });

  test('references outside the search scope drop to unknowns and are reported', () => {
    const reply = JSON.stringify({
      outcome: 'answer',
      candidates: [
        {
          productId: 'halden-task-chair',
          claims: [{ recordId: 'rec-hallucinated' }, { recordId: 'rec-halden-seat-height' }],
        },
      ],
    });
    const { draft, droppedRecordIds, coercions } = parseModelDraft(reply, [makeValueRecord()], 'q');
    expect(droppedRecordIds).toEqual(['rec-hallucinated']);
    expect(draft.candidates[0]?.claims).toEqual([{ recordId: 'rec-halden-seat-height' }]);
    const reported = draft.unknowns.find((unknown) => unknown.reason.includes('rec-hallucinated'));
    expect(reported?.status).toBe('not-found');
    expect(coercions.join(' ')).toContain('rec-hallucinated');
  });

  test('an unparseable reply refuses — never guesses', () => {
    const { draft, coercions } = parseModelDraft('I would say Class A.', [makeValueRecord()], 'q');
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.status).toBe('unresolvable');
    expect(coercions.join(' ')).toContain('not valid JSON');
  });

  test('an answer with no references and no unknowns coerces to a refusal', () => {
    const reply = JSON.stringify({ outcome: 'answer', commentary: ['Looks fine to me.'] });
    const { draft, coercions } = parseModelDraft(reply, [makeValueRecord()], 'q');
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.reason).toContain('no library references');
    expect(coercions.join(' ')).toContain('coerced to refuse');
  });

  test('a clarify keeps only the question back — candidates are dropped, visibly', () => {
    const reply = JSON.stringify({
      outcome: 'clarify',
      questionBack: {
        ambiguity: '"soundproof" can mean three things',
        readings: [
          { reading: 'acoustic absorption', whatItWouldChange: 'different property to compare' },
        ],
      },
      candidates: [
        { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
      ],
    });
    const { draft, coercions } = parseModelDraft(reply, [makeValueRecord()], 'q');
    expect(draft.outcome).toBe('clarify');
    expect(draft.questionBack?.readings).toHaveLength(1);
    expect(draft.candidates).toEqual([]);
    expect(coercions.join(' ')).toContain('candidates dropped');
  });

  test('a clarify without usable readings coerces to a refusal — asking back must name readings', () => {
    const reply = JSON.stringify({ outcome: 'clarify', questionBack: { ambiguity: 'unclear' } });
    const { draft } = parseModelDraft(reply, [makeValueRecord()], 'q');
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.status).toBe('unresolvable');
  });

  test('empty unknown reasons are coerced, never left blank', () => {
    const reply = JSON.stringify({
      outcome: 'answer',
      unknowns: [
        { propertyId: 'fire-rating', status: 'weird-status', reason: '', wouldResolve: '' },
      ],
    });
    const { draft, coercions } = parseModelDraft(reply, [makeValueRecord()], 'q');
    const unknown = draft.unknowns[0];
    expect(unknown?.status).toBe('not-found');
    expect(unknown?.reason).toContain('gave no reason');
    expect(unknown?.wouldResolve).toContain('Not stated');
    expect(coercions.length).toBeGreaterThan(0);
  });
});

describe('ClaudeReasoner.answer — search, prompt, reply', () => {
  const validReply = JSON.stringify({
    outcome: 'answer',
    candidates: [
      { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
    ],
  });

  test('end to end on an injected transport: search feeds the prompt, the reply becomes a draft', async () => {
    const seen: ClaudeRequest[] = [];
    const transport: ClaudeTransport = async (request) => {
      seen.push(request);
      return validReply;
    };
    const reasoner = new ClaudeReasoner(library, 'test-key', { transport });
    // The keyword fake resolves literal terms; the question uses words its seed
    // record actually carries (the real library's semantic search handles lay phrasing).
    const draft = await reasoner.answer({ question: 'halden task chair' });
    expect(draft.outcome).toBe('answer');
    expect(draft.candidates[0]?.productId).toBe('halden-task-chair');
    expect(seen).toHaveLength(1);
    expect(seen[0]?.system).toContain('Never state values, quotes, or product names');
    expect(seen[0]?.prompt).toContain('halden task chair');
    expect(seen[0]?.prompt).toContain('rec-halden-seat-height');
    expect(seen[0]?.apiKey).toBe('test-key');
  });

  test('a failed search is its own outcome — search-failed, reported in refusal and unknowns', async () => {
    const failingSearch: LibrarySearchTool = {
      search: async () => {
        throw new LibrarySearchError('index unavailable');
      },
    };
    const mustNotBeCalled: ClaudeTransport = async () => {
      throw new Error('the model must not be called when the search fails');
    };
    const reasoner = new ClaudeReasoner(failingSearch, 'test-key', { transport: mustNotBeCalled });
    const draft = await reasoner.answer({ question: 'show me task chairs' });
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.status).toBe('search-failed');
    expect(draft.refusal?.reason).toContain('index unavailable');
    expect(draft.unknowns[0]?.status).toBe('search-failed');
    expect(draft.unknowns[0]?.wouldResolve).toBeTruthy();
  });

  test('a provider failure refuses rather than guess, carrying the reason', async () => {
    const failingTransport: ClaudeTransport = async () => {
      throw new ClaudeProviderError('Anthropic API returned 500');
    };
    const reasoner = new ClaudeReasoner(library, 'test-key', { transport: failingTransport });
    const draft = await reasoner.answer({ question: 'show me task chairs' });
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.status).toBe('unresolvable');
    expect(draft.refusal?.reason).toContain('500');
    expect(draft.candidates).toEqual([]);
  });
});
