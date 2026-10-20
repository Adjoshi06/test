// Computation tests — the deciding half (spec art_Ene8eA8R): meet/fail/unknown
// computed from recorded evidence, never judged. Every unknown states what
// would resolve it; cross-method comparisons are gated by the registry's
// decision, and an outage or an unregistered method is never a verdict.

import { describe, expect, it } from 'vitest';
import type { LibraryValueRecord } from '@/lib/reasoner/types';
import type { CheckedRequirement, Comparator, ComparisonOutcome } from './types';
import { computeCandidate, computeRequirement } from './compute';

const value = (over: Partial<LibraryValueRecord>): LibraryValueRecord => ({
  id: 'rec-1',
  kind: 'value',
  productId: 'halden-task-chair',
  propertyId: 'fire-rating',
  raw: 'class B-s1,d0',
  methodId: 'en-13501-1:2018',
  documentId: 'doc-1',
  documentTitle: 'Halden data sheet',
  locator: 'p. 4, §2.1',
  quote: 'Fire classification: B-s1,d0 per EN 13501-1',
  authority: 'product-doc',
  verification: 'human-verified',
  verifiedBy: 'A. Designer',
  ...over,
});

const requirement = (over: Partial<CheckedRequirement>): CheckedRequirement => ({
  propertyId: 'fire-rating',
  statement: 'flame-spread class B or better',
  source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
  ...over,
});

/** The registry, as a table — the checker sees only decisions. */
const EDGES: ReadonlyMap<string, ComparisonOutcome> = new Map([
  [
    'en-13501-1:2007|en-13501-1:2018',
    { verdict: 'comparable', basis: 'explicit-edge', reason: 'successive editions' },
  ],
  [
    'astm-e84|en-13501-1:2018',
    {
      verdict: 'not-comparable',
      basis: 'known-incomparable',
      reason: 'a Euroclass is not an E84 class',
    },
  ],
]);

const compare: Comparator = (a, b) => {
  if (a === b) return { verdict: 'comparable', basis: 'same-method', reason: 'same method' };
  return EDGES.get([a, b].sort().join('|')) ?? { kind: 'unregistered', methodIds: [a, b] };
};

const failingCompare: Comparator = () => ({ kind: 'registry-error' });

describe('computeRequirement — compliance is computed or unknown, never judged', () => {
  it('a checkless requirement is unknown, never judged', () => {
    const result = computeRequirement(requirement({ check: undefined }), 0, [value({})], compare);
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain('not stated in a checkable form');
    expect(result.wouldResolve).toContain('re-run');
  });

  it('nothing recorded for the property is unknown, with what would resolve it', () => {
    const result = computeRequirement(requirement({ check: { kind: 'present' } }), 0, [], compare);
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain("nothing is recorded for 'fire-rating'");
    expect(result.wouldResolve).toContain("records 'fire-rating'");
  });

  it('absence is never concluded from a search that found none', () => {
    const result = computeRequirement(requirement({ check: { kind: 'absent' } }), 0, [], compare);
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain('absence of evidence is not evidence of absence');
  });

  it('present meets on any attributable value; absent fails on one', () => {
    const present = computeRequirement(
      requirement({ check: { kind: 'present' } }),
      0,
      [value({})],
      compare
    );
    expect(present.verdict).toBe('meet');
    expect(present.evidence).toHaveLength(1);
    const absent = computeRequirement(
      requirement({ check: { kind: 'absent' } }),
      0,
      [value({})],
      compare
    );
    expect(absent.verdict).toBe('fail');
    expect(absent.reason).toContain('is not absent');
  });

  it('raw-equals meets on equality and fails on difference, same method', () => {
    const meets = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [value({})],
      compare
    );
    expect(meets.verdict).toBe('meet');
    expect(meets.reason).toContain('equal to');
    const fails = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class C-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [value({})],
      compare
    );
    expect(fails.verdict).toBe('fail');
    expect(fails.evidence).toHaveLength(1);
  });

  it('raw-equals across a registry-blessed bridge lets raw equality decide', () => {
    const older = value({ id: 'rec-2', methodId: 'en-13501-1:2007' });
    const meets = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [older],
      compare
    );
    expect(meets.verdict).toBe('meet');
    expect(meets.comparability?.basis).toBe('explicit-edge');
    const fails = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class C-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [older],
      compare
    );
    expect(fails.verdict).toBe('fail');
    expect(fails.comparability?.basis).toBe('explicit-edge');
  });

  it('a known-incomparable pair is unknown — the values must not be set side by side', () => {
    const astm = value({ id: 'rec-3', methodId: 'astm-e84', raw: 'class A' });
    const result = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [astm],
      compare
    );
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain('must not be set side by side');
    expect(result.comparability?.verdict).toBe('not-comparable');
  });

  it('an unregistered method is an integrity gap, not a comparison', () => {
    const result = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [value({ methodId: 'din-4102' })],
      compare
    );
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain('integrity gap');
  });

  it('a registry outage is an outage, never a verdict', () => {
    const result = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      [value({ methodId: 'astm-e84', raw: 'class A' })],
      failingCompare
    );
    expect(result.verdict).toBe('unknown');
    expect(result.reason).toContain('could not be consulted');
  });

  it('raw-not-equals mirrors: equality fails, recorded difference meets', () => {
    const fails = computeRequirement(
      requirement({ check: { kind: 'raw-not-equals', raw: 'class B-s1,d0' } }),
      0,
      [value({})],
      compare
    );
    expect(fails.verdict).toBe('fail');
    expect(fails.reason).toContain('which the requirement excludes');
    const meets = computeRequirement(
      requirement({ check: { kind: 'raw-not-equals', raw: 'class C-s1,d0' } }),
      0,
      [value({})],
      compare
    );
    expect(meets.verdict).toBe('meet');
  });

  it('the fold prefers meet, then fail, then unknown — citing what decided', () => {
    const mixed = [
      value({ id: 'rec-4', methodId: 'astm-e84', raw: 'class A' }), // not comparable → unknown
      value({ id: 'rec-5', raw: 'class C-s1,d0' }), // same method, different → fail
      value({ id: 'rec-6', raw: 'class B-s1,d0' }), // equal → meet
    ];
    const result = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      mixed,
      compare
    );
    expect(result.verdict).toBe('meet');
    expect(result.evidence).toHaveLength(3);

    const noMeet = mixed.filter((v) => v.id !== 'rec-6');
    const failResult = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      noMeet,
      compare
    );
    expect(failResult.verdict).toBe('fail');

    const onlyGated = mixed.filter((v) => v.id === 'rec-4');
    const unknownResult = computeRequirement(
      requirement({
        check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
      }),
      0,
      onlyGated,
      compare
    );
    expect(unknownResult.verdict).toBe('unknown');
  });
});

describe('computeCandidate — one row per candidate, one cell per requirement', () => {
  it('produces results in requirement order, filtered by property', () => {
    const requirements: CheckedRequirement[] = [
      requirement({ propertyId: 'fire-rating', check: { kind: 'present' } }),
      requirement({
        propertyId: 'seat-height',
        statement: 'adjustable',
        source: { kind: 'user' },
        check: { kind: 'present' },
      }),
    ];
    const records = [
      value({}),
      value({
        id: 'rec-7',
        propertyId: 'seat-height',
        raw: 'adjustable, 42–54 cm',
        methodId: 'measure',
        quote: 'Seat height 42–54 cm, gas-lift',
      }),
    ];
    const row = computeCandidate('halden-task-chair', records, requirements, compare);
    expect(row.productId).toBe('halden-task-chair');
    expect(row.results).toHaveLength(2);
    expect(row.results[0]?.verdict).toBe('meet');
    expect(row.results[1]?.verdict).toBe('meet');
    expect(row.results[0]?.evidence[0]?.id).toBe('rec-1');
    expect(row.results[1]?.evidence[0]?.id).toBe('rec-7');
  });

  it('a candidate with no records at all is a row of unknowns', () => {
    const row = computeCandidate(
      'vind-desk-chair',
      [],
      [requirement({ check: { kind: 'present' } })],
      compare
    );
    expect(row.results).toHaveLength(1);
    expect(row.results[0]?.verdict).toBe('unknown');
  });

  it('passage records never become evidence for a verdict', () => {
    const row = computeCandidate(
      'halden-task-chair',
      [
        {
          id: 'rec-8',
          kind: 'passage',
          documentId: 'doc-1',
          documentTitle: 'Halden data sheet',
          locator: 'p. 2',
          quote: 'Seat height is adjustable.',
          authority: 'product-doc',
          verification: 'interpreted',
        },
      ],
      [requirement({ check: { kind: 'present' } })],
      compare
    );
    expect(row.results[0]?.verdict).toBe('unknown');
    expect(row.results[0]?.evidence).toHaveLength(0);
  });
});
