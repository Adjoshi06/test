import { describe, expect, it } from 'vitest';
import { ScriptedEngine } from './engine';
import { SCRIPTED_ANSWERS, SCRIPTED_LIBRARY } from './fixtures';
import { GRADERS, gradeCase } from './grader';
import type { AnswerDraft, EvalCase, ScriptedRecord } from './schema';

const resolveRecord = (recordId: string) => SCRIPTED_LIBRARY[recordId];
const engine = new ScriptedEngine(SCRIPTED_ANSWERS);

const discoveryCase: EvalCase = {
  id: 'tc-test-discovery',
  title: 'Discovery — task chairs',
  kind: 'discovery',
  question: 'show me task chairs',
  expected: { candidateIds: ['halden-task-chair', 'vind-desk-chair'] },
};

describe('gradeCase', () => {
  it('passes all five standing questions for the scripted discovery case', () => {
    const result = gradeCase(discoveryCase, engine.answer(discoveryCase.question), resolveRecord);
    expect(result.passed).toBe(true);
    for (const grader of GRADERS) {
      expect(result.questions[grader.question].verdict).toBe('pass');
    }
  });

  it('fails traceability when a claim does not resolve to a library record', () => {
    const answer: AnswerDraft = {
      outcome: 'answer',
      candidates: [{ productId: 'halden-task-chair', claims: [{ recordId: 'rec-missing' }] }],
    };
    const result = gradeCase(discoveryCase, answer, resolveRecord);
    expect(result.passed).toBe(false);
    expect(result.questions.traceability.verdict).toBe('fail');
    expect(result.questions.traceability.reason).toContain('rec-missing');
  });

  it('fails unknown-honesty when a must-stay-unknown property is asserted', () => {
    const evalCase: EvalCase = {
      ...discoveryCase,
      expected: {
        candidateIds: ['halden-task-chair'],
        unknownProperties: ['seat-height-adjustable'],
      },
    };
    const result = gradeCase(evalCase, engine.answer(evalCase.question), resolveRecord);
    expect(result.questions['unknown-honesty'].verdict).toBe('fail');
    expect(result.questions['unknown-honesty'].reason).toContain('seat-height-adjustable');
  });

  it('fails verification-honesty when human-verified carries no verifier', () => {
    const library: Record<string, ScriptedRecord> = {
      'rec-bad': {
        id: 'rec-bad',
        propertyId: 'seat-height-adjustable',
        documentTitle: 'Halden spec (synthetic fixture)',
        locator: 'p. 4, §2.1',
        quote: 'Seat height adjustable 42–55 cm via gas lift.',
        verification: 'human-verified' as const,
      },
    };
    const answer: AnswerDraft = {
      outcome: 'answer',
      candidates: [{ productId: 'halden-task-chair', claims: [{ recordId: 'rec-bad' }] }],
    };
    const result = gradeCase(discoveryCase, answer, (recordId) => library[recordId]);
    expect(result.questions['verification-honesty'].verdict).toBe('fail');
    expect(result.questions['verification-honesty'].reason).toContain('rec-bad');
  });

  it('fails clarify-not-guess when an ambiguous question is answered instead of asked back', () => {
    const evalCase: EvalCase = {
      id: 'tc-test-ambiguous',
      title: 'Ambiguous — quiet',
      kind: 'ambiguous',
      question: 'something quiet for the office',
      expected: {},
    };
    const result = gradeCase(evalCase, { outcome: 'answer' }, resolveRecord);
    expect(result.questions['clarify-not-guess'].verdict).toBe('fail');
  });

  it('passes clarify-not-guess when an ambiguous question gets a question back', () => {
    const evalCase: EvalCase = {
      id: 'tc-test-ambiguous',
      title: 'Ambiguous — quiet',
      kind: 'ambiguous',
      question: 'something quiet for the office',
      expected: {},
    };
    const result = gradeCase(
      evalCase,
      {
        outcome: 'clarify',
        readings: ['sound isolation between rooms', 'reverberation control inside the room'],
      },
      resolveRecord
    );
    expect(result.questions['clarify-not-guess'].verdict).toBe('pass');
  });

  it('fails clarify-not-guess when a clarify-back names no readings', () => {
    const evalCase: EvalCase = {
      id: 'tc-test-ambiguous',
      title: 'Ambiguous — quiet',
      kind: 'ambiguous',
      question: 'something quiet for the office',
      expected: {},
    };
    const result = gradeCase(evalCase, { outcome: 'clarify' }, resolveRecord);
    expect(result.questions['clarify-not-guess'].verdict).toBe('fail');
    expect(result.questions['clarify-not-guess'].reason).toContain('readings');
  });

  it('passes clarify-not-guess when an unsupported question refuses with its reason', () => {
    const evalCase: EvalCase = {
      id: 'tc-test-unsupported',
      title: 'Unsupported — pricing',
      kind: 'unsupported',
      question: 'which pendant lights are under $300?',
      expected: {},
    };
    const result = gradeCase(
      evalCase,
      { outcome: 'refuse', refusalReason: 'No pricing exists in the library.' },
      resolveRecord
    );
    expect(result.questions['clarify-not-guess'].verdict).toBe('pass');
  });

  it('fails clarify-not-guess when a refusal carries no reason', () => {
    const evalCase: EvalCase = {
      id: 'tc-test-unsupported',
      title: 'Unsupported — pricing',
      kind: 'unsupported',
      question: 'which pendant lights are under $300?',
      expected: {},
    };
    const result = gradeCase(evalCase, { outcome: 'refuse' }, resolveRecord);
    expect(result.questions['clarify-not-guess'].verdict).toBe('fail');
    expect(result.questions['clarify-not-guess'].reason).toContain('state why');
  });

  it('fails traceability when a refusal carries claims', () => {
    const answer: AnswerDraft = {
      outcome: 'refuse',
      refusalReason: 'No pricing exists in the library.',
      candidates: [{ productId: 'lume-pendant', claims: [{ recordId: 'rec-lume-photometry' }] }],
    };
    const result = gradeCase(discoveryCase, answer, resolveRecord);
    expect(result.questions.traceability.verdict).toBe('fail');
    expect(result.questions.traceability.reason).toContain('not a vehicle for values');
  });

  it('fails unknown-honesty when an expected search failure is reported as not-found', () => {
    const evalCase: EvalCase = {
      ...discoveryCase,
      expected: {
        candidateIds: ['halden-task-chair', 'vind-desk-chair'],
        unknownProperties: ['flame-spread'],
        searchFailedProperties: ['flame-spread'],
      },
    };
    const answer: AnswerDraft = {
      outcome: 'answer',
      candidates: [{ productId: 'vind-desk-chair', claims: [{ recordId: 'rec-vind-finish' }] }],
      unknowns: [
        {
          propertyId: 'flame-spread',
          reason: 'No flame-spread entry in the library.',
          status: 'not-found',
        },
      ],
    };
    const result = gradeCase(evalCase, answer, resolveRecord);
    expect(result.questions['unknown-honesty'].verdict).toBe('fail');
    expect(result.questions['unknown-honesty'].reason).toContain('search-failed');
  });

  it('fails candidates and clarify-not-guess when a discovery question refuses', () => {
    const result = gradeCase(discoveryCase, { outcome: 'refuse' }, resolveRecord);
    expect(result.questions.candidates.verdict).toBe('fail');
    expect(result.questions['clarify-not-guess'].verdict).toBe('fail');
  });
});
