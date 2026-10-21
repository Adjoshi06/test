import { describe, expect, it } from 'vitest';
import { FakeLibrarySearch } from './search';
import type { LibrarySearchQuery, LibrarySearchResult, LibrarySearchTool } from './search';
import { ViewerScopedSearch } from './scoped-search';
import type { LibraryRecord } from './types';

/** A delegate that counts searches — proving whether the model's tool ran. */
class CountingSearch implements LibrarySearchTool {
  calls: LibrarySearchQuery[] = [];

  constructor(private readonly result: LibrarySearchResult) {}

  async search(query: LibrarySearchQuery): Promise<LibrarySearchResult> {
    this.calls.push(query);
    return this.result;
  }
}

const seed: LibraryRecord[] = [
  {
    id: 'rec-halden-seat-height',
    kind: 'value',
    authority: 'product-doc',
    verification: 'interpreted',
    documentId: 'doc-halden-spec',
    documentTitle: 'Halden task chair — manufacturer specification',
    locator: 'p. 4, §2.1',
    quote: 'Seat height adjustable 42–55 cm, gas-lift class 4.',
    productId: 'halden-task-chair',
    propertyId: 'seat-height-range',
    raw: 'Seat height adjustable 42–55 cm',
    methodId: 'en-527-1',
  },
];

describe('ViewerScopedSearch', () => {
  it('an unauthenticated request returns nothing and never reaches the delegate', async () => {
    const delegate = new CountingSearch({ records: seed });
    const scoped = new ViewerScopedSearch(delegate, null);

    const result = await scoped.search({ terms: 'seat height' });

    expect(result).toEqual({ records: [] });
    expect(delegate.calls).toHaveLength(0);
  });

  it('an authenticated request reaches the delegate and passes its records through', async () => {
    const delegate = new CountingSearch({ records: seed });
    const scoped = new ViewerScopedSearch(delegate, { userId: 'u-1' });

    const result = await scoped.search({ terms: 'seat height' });

    expect(result).toEqual({ records: seed });
    expect(delegate.calls).toEqual([{ terms: 'seat height' }]);
  });

  it('an authenticated search against the fake still returns only matching records', async () => {
    const scoped = new ViewerScopedSearch(new FakeLibrarySearch(seed), { userId: 'u-1' });

    const hit = await scoped.search({ terms: 'halden' });
    expect(hit.records).toHaveLength(1);

    const miss = await scoped.search({ terms: 'unrelated' });
    expect(miss.records).toEqual([]);
  });
});
