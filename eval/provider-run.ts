// Recorded real-provider run — evidence, not a gate.
//
// Runs the standing case set through the Claude reasoner behind the same
// Reasoner interface the scripted gate uses, grades every draft with the same
// five graders, and writes a results file for the recorded-run document. The
// The search tool is a keyword-recall stand-in over the scripted fixture
// library (KeywordRecallSearch below) - this release has no database-backed
// search. It answers the questions the office actually asks the way the real
// library's semantic search eventually will; genuinely semantic lay terms
// ("soundproof", "lighting for a room") still miss, and the run records that
// honestly. The run exercises the reasoner's reading, retrieval discipline,
// and reference-only drafting against a real provider - not retrieval quality
// over a live corpus. CI's gate remains the scripted engine (npm run eval:ci).
//
// The run requires an API key from an injected secret (SECRET_ANTHROPIC_API_KEY
// or ANTHROPIC_API_KEY). Without one the runner exits non-zero: a scripted
// result is never recorded as a provider run.

import { createClaudeReasoner } from '@/lib/reasoner/claude-adapter';
import type {
  LibrarySearchQuery,
  LibrarySearchResult,
  LibrarySearchTool,
} from '@/lib/reasoner/search';
import type {
  AnswerDraft as ReasonerAnswerDraft,
  LibraryRecord,
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

// Function words carry no retrieval signal - "show me task chairs" must find
// task chairs, not fail because no record says "show". A fixed closed list,
// tokenized on non-alphanumerics (so "chair's" and "flame-spread" split),
// keeps the stand-in deterministic and honest: no hits, no records.
const FUNCTION_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'am',
  'do',
  'does',
  'did',
  'doing',
  'has',
  'have',
  'had',
  'having',
  'can',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'i',
  'we',
  'you',
  'your',
  'my',
  'our',
  'it',
  'its',
  'they',
  'them',
  'their',
  'this',
  'that',
  'these',
  'those',
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'for',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'with',
  'from',
  'as',
  'into',
  'about',
  'over',
  'under',
  'what',
  'which',
  'who',
  'whose',
  'how',
  'show',
  'give',
  'tell',
  'please',
  'me',
  'us',
  'need',
  'want',
  'looking',
]);

const significantTerms = (question: string): string[] =>
  question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !FUNCTION_WORDS.has(word));

const termHits = (term: string, haystack: string): boolean =>
  haystack.includes(term) ||
  // Plural tolerance: "chairs" must find "chair" - a real search stems; this
  // stand-in does the one plural case it needs and nothing more.
  (term.endsWith('s') && !term.endsWith('ss') && haystack.includes(term.slice(0, -1)));

/**
 * The retrieval stand-in for the recorded run. The search double behind the
 * reasoner tests matches terms literally (its documented contract - lay-term
 * retrieval is the real library's semantic job), which returns nothing for
 * natural-language questions. Until the real library task lands, the provider
 * run needs a search that answers the office's questions the way the real one
 * will: recall on ANY significant term. It invents nothing - a record hits
 * only when its own text contains a queried term; the reasoner still picks
 * the candidates.
 */
export class KeywordRecallSearch implements LibrarySearchTool {
  constructor(private readonly seed: readonly LibraryRecord[]) {}

  async search(query: LibrarySearchQuery): Promise<LibrarySearchResult> {
    const terms = significantTerms(query.terms);
    if (terms.length === 0) return { records: [] };
    const records = this.seed.filter((record) => {
      if (query.propertyIds && !query.propertyIds.includes(record.propertyId ?? '')) return false;
      if (query.productIds && !query.productIds.includes(record.productId ?? '')) return false;
      const haystack = [
        record.documentTitle,
        record.quote,
        record.propertyId ?? '',
        record.productId ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.some((term) => termHits(term, haystack));
    });
    // Same determinism contract as the search double: identical seed and
    // question, identical records in id order.
    return { records: [...records].sort((a, b) => a.id.localeCompare(b.id)) };
  }
}

export function providerSearch(): KeywordRecallSearch {
  return new KeywordRecallSearch(providerLibrarySeed());
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
