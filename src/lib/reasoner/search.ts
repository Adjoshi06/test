// The reasoner's one tool: library search. It returns records — passages,
// values, verification states — never prose. There is no field on the result
// where a generated answer could hide: the model reads evidence and references
// record ids; it does not receive prose to repeat (spec art_Ene8eA8R, "the
// reasoner has one tool: library search").
//
// FakeLibrarySearch is the deterministic double the reasoner tests run against
// until the real library task lands; it invents nothing — no hits, no records.

import type { LibraryRecord } from './types';

export interface LibrarySearchQuery {
  /** Free-text terms — the office's own words or explicit property ids. */
  terms: string;
  /** Optional canonical property filter, e.g. ['fire-rating']. */
  propertyIds?: readonly string[];
  /** Optional product filter, e.g. ['halden-task-chair']. */
  productIds?: readonly string[];
}

export interface LibrarySearchResult {
  /** Matching records with their evidence and verification states — never prose. */
  records: readonly LibraryRecord[];
}

export interface LibrarySearchTool {
  search(query: LibrarySearchQuery): Promise<LibrarySearchResult>;
}

/**
 * The search did not complete — distinct from finding nothing. Both outcomes
 * are reported and never blended (spec promise: unknown is an answer).
 */
export class LibrarySearchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'LibrarySearchError';
  }
}

/** A deterministic in-memory search double seeded with well-formed library records. */
export class FakeLibrarySearch implements LibrarySearchTool {
  constructor(private readonly seed: readonly LibraryRecord[]) {}

  async search(query: LibrarySearchQuery): Promise<LibrarySearchResult> {
    // Every term must hit somewhere — an AND keeps the fake predictable.
    const terms = query.terms
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    const records = this.seed.filter((record) => {
      if (query.propertyIds && !query.propertyIds.includes(record.propertyId ?? '')) return false;
      if (query.productIds && !query.productIds.includes(record.productId ?? '')) return false;
      if (terms.length === 0) return true;
      const haystack = [
        record.documentTitle,
        record.quote,
        record.propertyId ?? '',
        record.productId ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    // Sorted for determinism: identical seeds and queries give identical order.
    return { records: [...records].sort((a, b) => a.id.localeCompare(b.id)) };
  }
}
