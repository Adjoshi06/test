// Recorded real-provider run — evidence, not a gate.
//
// Runs the standing case set through the Claude reasoner behind the same
// Reasoner interface the scripted gate uses, grades every draft with the same
// five graders, and writes a results file for the recorded-run document. The
// search tool is the scripted fixture library — this release has no
// database-backed search — so the run exercises the reasoner's reading,
// retrieval discipline, and reference-only drafting against a real provider,
// not retrieval quality over a live corpus. CI's gate remains the scripted
// engine (npm run eval:ci).
//
// The run requires an API key from an injected secret (SECRET_ANTHROPIC_API_KEY
// or ANTHROPIC_API_KEY). Without one the runner exits non-zero: a scripted
// result is never recorded as a provider run.

import { createClaudeReasoner } from '@/lib/reasoner/claude-adapter';
import { FakeLibrarySearch } from '@/lib/reasoner/search';
import type {
  AnswerDraft as ReasonerAnswerDraft,
  LibraryValueRecord,
  Reasoner,
} from '@/lib/reasoner/types';
import { loadCases } from './cases';
import { SCRIPTED_LIBRARY } from './fixtures';
import { runHarness } from './run';
import type { AnswerDraft, HarnessResults, ResolveRecord } from './schema';

const slugDocumentId = (documentTitle: string): string =>
  documentTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * The fixture library as the reasoner's search seed. Every scripted record is
 * a manufacturer spec value, so authority is 'product-doc' throughout — the
 * same honesty rule the corpus keeps (synthetic, clearly marked).
 */
export function providerLibrarySeed(): LibraryValueRecord[] {
  return Object.values(SCRIPTED_LIBRARY).map((record) => ({
    id: record.id,
    kind: 'value' as const,
    authority: 'product-doc' as const,
    verification: record.verification,
    ...(record.verifiedBy === undefined ? {} : { verifiedBy: record.verifiedBy }),
    documentId: slugDocumentId(record.documentTitle),
    documentTitle: record.documentTitle,
    locator: record.locator,
    quote: record.quote,
    productId: record.productId,
    propertyId: record.propertyId,
    methodId: record.methodId,
    raw: record.quote,
  }));
}

/**
 * Map the reasoner's full draft onto the eval schema's graded surface — the
 * candidates pass through as bare record references; unknowns carry their
 * status; the question-back's readings and the refusal's reason are lifted.
 * Interpretation and commentary are the reasoner's own words, not graded
 * evidence, and stay behind.
 */
export function toEvalDraft(draft: ReasonerAnswerDraft): AnswerDraft {
  return {
    outcome: draft.outcome,
    candidates: draft.candidates.map((candidate) => ({
      productId: candidate.productId,
      claims: candidate.claims.map((claim) => ({ recordId: claim.recordId })),
    })),
    unknowns: draft.unknowns.map((unknown) => ({
      propertyId: unknown.propertyId,
      reason: unknown.reason,
      status: unknown.status,
    })),
    ...(draft.questionBack === undefined
      ? {}
      : { readings: draft.questionBack.readings.map((reading) => reading.reading) }),
    ...(draft.refusal === undefined ? {} : { refusalReason: draft.refusal.reason }),
  };
}

export const resolveScriptedRecord: ResolveRecord = (recordId) => SCRIPTED_LIBRARY[recordId];

export function providerSearch(): FakeLibrarySearch {
  return new FakeLibrarySearch(providerLibrarySeed());
}

export async function runProviderHarness(reasoner: Reasoner): Promise<HarnessResults> {
  const cases = await loadCases();
  return runHarness(
    cases,
    (question) => reasoner.answer({ question }).then(toEvalDraft),
    resolveScriptedRecord,
    reasoner.name
  );
}

export type ProviderAvailability =
  { available: true; reasoner: Reasoner } | { available: false; reason: string };

/** The Claude reasoner over the fixture library — or the precise reason it cannot run. */
export function providerReasoner(
  env: Readonly<Record<string, string | undefined>> = process.env
): ProviderAvailability {
  const availability = createClaudeReasoner(providerSearch(), env);
  return availability.available
    ? { available: true, reasoner: availability.reasoner }
    : { available: false, reason: availability.reason };
}
