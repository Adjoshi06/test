// Prompt contract tests: the office rules ride on every prompt the adapter
// builds, asserted by phrase so a rewrite cannot silently drop one. The user
// prompt echoes the question, lists the searched records as the only
// referencable ids, and states the required JSON shape.

import { describe, expect, test } from 'vitest';
import {
  DRAFT_JSON_SHAPE,
  OFFICE_RULES,
  buildOfficeRulesSystemPrompt,
  buildReasonerPrompt,
  describeRecord,
} from './prompt';
import { makeValueRecord } from './test-fixtures';

const record = makeValueRecord();

describe('the office rules', () => {
  test('the five rules are asserted by phrase, not just by array membership', () => {
    const system = buildOfficeRulesSystemPrompt();
    expect(system).toMatch(/Translate lay terms explicitly/);
    expect(system).toMatch(/Ask rather than guess/);
    expect(system).toMatch(/Propose unknown rather than fill/);
    expect(system).toMatch(/Never state values, quotes, or product names on your own authority/);
    expect(system).toMatch(/Stop rather than guess on missing support/);
  });

  test('every exported rule appears verbatim on the system prompt', () => {
    const system = buildOfficeRulesSystemPrompt();
    for (const rule of OFFICE_RULES) {
      expect(system).toContain(rule);
    }
  });
});

describe('the user prompt', () => {
  test('echoes the question verbatim — the office’s own words are what it answers', () => {
    const prompt = buildReasonerPrompt('what can seat the studio in black?', [record]);
    expect(prompt).toContain('what can seat the studio in black?');
  });

  test('lists the search results as the only referencable record ids, with their verification state', () => {
    const prompt = buildReasonerPrompt('show me task chairs', [record]);
    expect(prompt).toContain('rec-halden-seat-height');
    expect(prompt).toContain('rec-halden-seat-height — '); // the catalog line
    expect(prompt).toContain('seat-height-adjustable');
    expect(prompt).toContain('human-verified');
    expect(prompt).toContain('the only record ids you may reference');
  });

  test('an empty search result says so instead of listing ids', () => {
    const prompt = buildReasonerPrompt('show me task chairs', []);
    expect(prompt).toContain('(none');
  });

  test('states the required JSON shape, including the reference-only claim', () => {
    const prompt = buildReasonerPrompt('q', [record]);
    expect(prompt).toContain(DRAFT_JSON_SHAPE);
    expect(prompt).toContain('"recordId"');
    expect(prompt).toContain('"wouldResolve"');
  });
});

describe('describeRecord', () => {
  test('value records show property, recorded raw value, method, authority and verification', () => {
    const line = describeRecord(record);
    expect(line).toContain('seat-height-adjustable');
    expect(line).toContain('42–55 cm');
    expect(line).toContain('stated-range');
    expect(line).toContain('product-doc');
    expect(line).toContain('human-verified');
    expect(line).toContain('seed-author');
  });

  test('machine-read records never look human-verified — verification honesty in the prompt itself', () => {
    const line = describeRecord(
      makeValueRecord({ id: 'rec-x', verification: 'machine-read', verifiedBy: undefined })
    );
    expect(line).toContain('machine-read');
    expect(line).toContain('not human-verified');
    expect(line).not.toContain('verified by');
  });
});
