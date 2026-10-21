// Case-set integrity — the static checks that catch drift before a run: cases
// in the office's own words must speak the seeded corpus's language, every
// case question must have a scripted answer (and nothing more), and every
// scripted claim must resolve to a record that carries its evidence.

import { describe, expect, it } from 'vitest';
import { FIXTURE_CORPUS } from '@/fixtures/corpus';
import { loadCases } from './cases';
import { CASE_KINDS } from './schema';
import { SCRIPTED_ANSWERS, SCRIPTED_LIBRARY } from './fixtures';

// The corpus as the office's library: product keys, and the properties each
// product's own document records values for.
const productKeys = new Set(FIXTURE_CORPUS.products.map((product) => product.key));

const propertiesByProduct = new Map<string, Set<string>>(
  FIXTURE_CORPUS.products.map((product) => {
    const document = FIXTURE_CORPUS.documents.find((entry) => entry.key === product.documentKey);
    return [product.key, new Set((document?.values ?? []).map((value) => value.propertyId))];
  })
);

const propertiesAnywhere = new Set(
  FIXTURE_CORPUS.documents.flatMap((document) => document.values.map((value) => value.propertyId))
);

describe('the case set', () => {
  it('covers every case kind, with unique ids and realistic depth', async () => {
    const cases = await loadCases();
    expect(cases.length).toBeGreaterThanOrEqual(10);

    const ids = cases.map((entry) => entry.id);
    expect(new Set(ids).size, 'case ids must be unique').toBe(ids.length);

    for (const kind of CASE_KINDS) {
      expect(
        cases.some((entry) => entry.kind === kind),
        `no case of kind ${kind}`
      ).toBe(true);
    }
  });

  it('names only products the corpus holds, and gaps the corpus keeps', async () => {
    const cases = await loadCases();
    for (const evalCase of cases) {
      for (const productId of evalCase.expected.candidateIds ?? []) {
        expect(productKeys.has(productId), `${evalCase.id}: unknown product ${productId}`).toBe(
          true
        );
      }
      for (const propertyId of evalCase.expected.unknownProperties ?? []) {
        const candidates = evalCase.expected.candidateIds ?? [];
        if (candidates.length === 0) {
          expect(
            propertiesAnywhere.has(propertyId),
            `${evalCase.id}: ${propertyId} exists in the corpus — it cannot be expected unknown corpus-wide`
          ).toBe(false);
        } else {
          for (const candidate of candidates) {
            const recorded = propertiesByProduct.get(candidate) ?? new Set();
            expect(
              recorded.has(propertyId),
              `${evalCase.id}: ${candidate} carries a ${propertyId} value — the gap does not hold`
            ).toBe(false);
          }
        }
      }
    }
  });

  it('scripts exactly the case questions — no orphan cases, no orphan answers', async () => {
    const cases = await loadCases();
    const questions = cases.map((entry) => entry.question);
    expect(new Set(questions).size, 'case questions must be unique (exact-question lookup)').toBe(
      questions.length
    );

    const questionSet = new Set(questions);
    for (const question of questions) {
      expect(SCRIPTED_ANSWERS[question], `no scripted answer for "${question}"`).toBeDefined();
    }
    for (const question of Object.keys(SCRIPTED_ANSWERS)) {
      expect(questionSet.has(question), `scripted answer not in the case set: "${question}"`).toBe(
        true
      );
    }
  });

  it('scripts claims that resolve to records carrying their evidence', () => {
    for (const [question, draft] of Object.entries(SCRIPTED_ANSWERS)) {
      for (const candidate of draft.candidates ?? []) {
        for (const claim of candidate.claims) {
          const record = SCRIPTED_LIBRARY[claim.recordId];
          if (record === undefined) {
            throw new Error(`${question}: ${claim.recordId} does not resolve`);
          }
          expect(record.locator.trim(), `${claim.recordId}: empty locator`).not.toBe('');
          expect(record.quote.trim(), `${claim.recordId}: empty quote`).not.toBe('');
        }
      }
      for (const unknown of draft.unknowns ?? []) {
        expect(unknown.reason.trim(), `${question}: unknown without a reason`).not.toBe('');
      }
    }
  });
});
