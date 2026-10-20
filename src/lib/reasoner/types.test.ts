// Contract tests for the draft types — the boundary invariant, checked
// structurally: a claim is a record reference and nothing else, and the
// reasoner's draft is assignable to the eval harness's graded projection.

import { describe, expect, test } from 'vitest';
import type { AnswerDraft as EvalAnswerDraft } from '../../../eval/schema';
import { refusalDraft } from './types';
import type { AnswerDraft, ProposedClaim } from './types';

const fullAnswerDraft: AnswerDraft = {
  outcome: 'answer',
  interpretation: [
    {
      statement: 'Task chairs for seated desk work.',
      translations: [
        { layTerm: 'ergonomic', explicitTerm: 'adjustable seat height + lumbar support' },
      ],
      inferredNeeds: ['lumbar support'],
    },
  ],
  requirements: [
    {
      propertyId: 'flame-spread-class',
      statement: 'Flame-spread class B or better',
      source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
    },
    {
      propertyId: 'lumbar-support',
      statement: 'Lumbar support',
      source: { kind: 'inference', basis: 'from "ergonomic"' },
    },
  ],
  candidates: [
    {
      productId: 'halden-task-chair',
      claims: [{ recordId: 'rec-halden-seat-height' }],
    },
  ],
  commentary: ['Halden fits the brief best on what the library holds.'],
  unknowns: [
    {
      propertyId: 'flame-spread-class',
      status: 'not-found',
      reason: 'A full library search found no flame-spread entry for Halden.',
      wouldResolve: 'The manufacturer’s fire certificate.',
    },
  ],
};

describe('AnswerDraft types — the boundary invariant', () => {
  test('a claim carries nothing but the record id — no field a value could hide in', () => {
    const claim: ProposedClaim = { recordId: 'rec-halden-seat-height' };
    expect(Object.keys(claim)).toEqual(['recordId']);
  });

  test('a reasoner draft is assignable to the eval harness projection — the harness grades reasoner output directly', () => {
    // Compile-time proof: the assignment below only type-checks when every
    // field the harness grades is present with the harness's own shape.
    const evalDraft: EvalAnswerDraft = fullAnswerDraft;
    expect(evalDraft.outcome).toBe('answer');
    expect(evalDraft.candidates?.[0]?.productId).toBe('halden-task-chair');
    expect(evalDraft.candidates?.[0]?.claims[0]?.recordId).toBe('rec-halden-seat-height');
    expect(evalDraft.unknowns?.[0]?.propertyId).toBe('flame-spread-class');
    expect(evalDraft.unknowns?.[0]?.reason).toContain('no flame-spread entry');
  });

  test('the draft carries the spec’s six answer parts', () => {
    expect(Object.keys(fullAnswerDraft)).toEqual(
      expect.arrayContaining([
        'outcome',
        'interpretation',
        'requirements',
        'candidates',
        'commentary',
        'unknowns',
      ])
    );
  });

  test('refusals keep the six-part shape — what was understood, nothing asserted, why it stops', () => {
    const draft = refusalDraft(
      'What is the fire rating of the Mera conference chair?',
      {
        status: 'not-found',
        reason: 'The library holds no fire rating for the Mera conference chair.',
      },
      [
        {
          propertyId: '*',
          status: 'not-found',
          reason: 'The library lacks the manufacturer’s fire certificate.',
          wouldResolve: 'Obtain the fire certificate and add it to the library.',
        },
      ]
    );
    expect(draft.outcome).toBe('refuse');
    expect(draft.refusal?.status).toBe('not-found');
    expect(draft.refusal?.reason).toContain('Mera');
    expect(draft.candidates).toEqual([]);
    expect(draft.commentary).toEqual([]);
    expect(draft.unknowns[0]?.wouldResolve).toContain('fire certificate');
    expect(draft.interpretation[0]?.statement).toContain('fire rating');
  });

  test('not-found and search-failed are distinct unknown statuses — both reportable', () => {
    expect(fullAnswerDraft.unknowns[0]?.status).toBe('not-found');
    const failed: AnswerDraft = {
      ...fullAnswerDraft,
      unknowns: [
        {
          propertyId: 'flame-spread-class',
          status: 'search-failed',
          reason: 'The search did not complete (index unavailable).',
          wouldResolve: 'A retry re-runs the search.',
        },
      ],
    };
    expect(failed.unknowns[0]?.status).toBe('search-failed');
  });
});
