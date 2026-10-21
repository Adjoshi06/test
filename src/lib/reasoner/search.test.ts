// Contract tests for the library-search tool: it returns records — passages,
// values, verification states — never prose. No field on the result carries a
// generated answer; every record carries its evidence.

import { describe, expect, test } from 'vitest';
import { FakeLibrarySearch } from './search';
import { makePassageRecord, makeValueRecord } from './test-fixtures';
import type { LibraryRecord } from './types';

const seeds: LibraryRecord[] = [
  makeValueRecord({
    id: 'rec-b-fire-rating',
    productId: 'mera-conference',
    propertyId: 'flame-spread-class',
    raw: 'Class A',
    quote: 'Flame-spread index 25 or less (Class A).',
    locator: 'p. 7, §3.2',
    verification: 'machine-read',
    verifiedBy: undefined,
  }),
  makeValueRecord({ id: 'rec-a-seat-height' }),
  makePassageRecord({ id: 'rec-c-brief-finish' }),
];

describe('FakeLibrarySearch — the reasoner’s one tool', () => {
  test('returns records with the full evidence contract — never prose', async () => {
    // The fake matches terms literally; lay-term retrieval is the real library's
    // semantic job, not this double's.
    const result = await new FakeLibrarySearch(seeds).search({ terms: 'flame class' });
    expect(Object.keys(result)).toEqual(['records']);
    const record = result.records[0];
    expect(record).toBeDefined();
    expect(record?.documentId).toBeTruthy();
    expect(record?.documentTitle).toContain('synthetic fixture');
    expect(record?.locator).toBeTruthy();
    expect(record?.quote).toContain('Flame-spread');
    expect(['human-verified', 'interpreted', 'machine-read']).toContain(record?.verification);
  });

  test('matches terms AND across title, quote, property and product, case-insensitively', async () => {
    const search = new FakeLibrarySearch(seeds);
    expect((await search.search({ terms: 'FLAME class' })).records.map((r) => r.id)).toEqual([
      'rec-b-fire-rating',
    ]);
    expect((await search.search({ terms: 'halden seat' })).records.map((r) => r.id)).toEqual([
      'rec-a-seat-height',
    ]);
    // AND semantics: both terms must hit.
    expect((await search.search({ terms: 'halden fire' })).records).toEqual([]);
  });

  test('filters by property and product', async () => {
    const search = new FakeLibrarySearch(seeds);
    const byProperty = await search.search({ terms: '', propertyIds: ['flame-spread-class'] });
    expect(byProperty.records.map((r) => r.id)).toEqual(['rec-b-fire-rating']);
    const byProduct = await search.search({ terms: '', productIds: ['halden-task-chair'] });
    expect(byProduct.records.map((r) => r.id)).toEqual(['rec-a-seat-height']);
    const both = await search.search({
      terms: '',
      propertyIds: ['flame-spread-class'],
      productIds: ['halden-task-chair'],
    });
    expect(both.records).toEqual([]);
  });

  test('no hits returns an empty records array — never a summary in place of data', async () => {
    const result = await new FakeLibrarySearch(seeds).search({ terms: 'tile ceiling' });
    expect(result).toEqual({ records: [] });
  });

  test('results are deterministically ordered by id', async () => {
    const result = await new FakeLibrarySearch(seeds).search({ terms: '' });
    expect(result.records.map((r) => r.id)).toEqual([
      'rec-a-seat-height',
      'rec-b-fire-rating',
      'rec-c-brief-finish',
    ]);
  });

  test('passage records carry their source and verification state too', async () => {
    const result = await new FakeLibrarySearch(seeds).search({ terms: 'brief black' });
    const record = result.records[0];
    expect(record?.kind).toBe('passage');
    expect(record?.authority).toBe('project');
    expect(record?.verification).toBe('interpreted');
  });
});
