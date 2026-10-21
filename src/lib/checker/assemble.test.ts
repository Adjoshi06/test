// Assembly tests — the whole checker against the boundary invariant (spec
// art_Ene8eA8R): whatever arrives, the answer asserts only what resolves to a
// library record; everything else survives as an unknown with its reason and
// what would resolve it. The property suite corrupts drafts and poisons the
// record map randomly (seeded, so CI is deterministic) and asserts the
// invariant holds for every input.

import { describe, expect, it } from 'vitest';
import type { LibraryRecord, LibraryValueRecord } from '@/lib/reasoner/types';
import type { CheckedAnswer, Comparator } from './types';
import { assembleAnswer } from './assemble';

// --- Test material ------------------------------------------------------------

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
  quote: 'B-s1,d0 per EN 13501-1',
  authority: 'product-doc',
  verification: 'human-verified',
  verifiedBy: 'A. Designer',
  ...over,
});

const meraValue = value({
  id: 'rec-2',
  productId: 'mera-conference',
  raw: 'class C-s1,d0',
  locator: 'p. 7',
});

const compare: Comparator = (a, b) => {
  if (a === b) return { verdict: 'comparable', basis: 'same-method', reason: 'same method' };
  const pair = [a, b].sort().join('|');
  if (pair === 'en-13501-1:2007|en-13501-1:2018') {
    return { verdict: 'comparable', basis: 'explicit-edge', reason: 'successive editions' };
  }
  if (pair === 'astm-e84|en-13501-1:2018') {
    return {
      verdict: 'not-comparable',
      basis: 'known-incomparable',
      reason: 'a Euroclass is not an E84 class',
    };
  }
  return { kind: 'unregistered', methodIds: [a, b] };
};

const goodDraft = {
  outcome: 'answer',
  interpretation: [
    {
      statement: 'task chairs for seated desk work',
      translations: [
        { layTerm: 'ergonomic', explicitTerm: 'adjustable seat height + lumbar support' },
      ],
      inferredNeeds: ['lumbar support'],
    },
  ],
  requirements: [
    {
      propertyId: 'fire-rating',
      statement: 'flame-spread class B or better',
      source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
      check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
    },
    {
      propertyId: 'finish',
      statement: 'black finish',
      source: { kind: 'project', ref: 'Brief 12 Feb, p. 3' },
      check: { kind: 'raw-equals', raw: 'black' },
    },
  ],
  candidates: [
    {
      productId: 'halden-task-chair',
      claims: [{ recordId: 'rec-1' }, { recordId: 'rec-finish' }],
    },
    { productId: 'mera-conference', claims: [{ recordId: 'rec-2' }, { recordId: 'rec-ghost' }] },
  ],
  commentary: ['Halden fits the brief best on what the library holds.'],
  unknowns: [
    {
      propertyId: 'fire-rating',
      status: 'not-found',
      reason: 'no entry for Vind',
      wouldResolve: 'the fire certificate',
    },
  ],
};

const recordsMap: ReadonlyMap<string, LibraryRecord | null> = new Map([
  ['rec-1', value({})],
  ['rec-2', meraValue],
  [
    'rec-finish',
    value({
      id: 'rec-finish',
      propertyId: 'finish',
      raw: 'black',
      methodId: 'colour',
      quote: 'Shell colour: black',
      locator: 'p. 3',
    }),
  ],
  ['rec-ghost', null], // a record the viewer cannot see — indistinguishable from absent
]);

describe('assembleAnswer — the six parts, on the happy path', () => {
  const answer = assembleAnswer({ draft: goodDraft, records: recordsMap, compare });

  it('is an answer with the interpretation and commentary carried through, visibly separate', () => {
    expect(answer.outcome).toBe('answer');
    expect(answer.interpretation[0]?.statement).toContain('task chairs');
    expect(answer.interpretation[0]?.translations[0]?.explicitTerm).toContain('lumbar');
    expect(answer.commentary).toEqual(['Halden fits the brief best on what the library holds.']);
  });

  it('shows the requirements with their sources', () => {
    expect(answer.requirements).toHaveLength(2);
    expect(answer.requirements[0]?.source).toEqual({ kind: 'code', ref: 'IBC 2024 §10.3.2' });
    expect(answer.requirements[1]?.source).toEqual({ kind: 'project', ref: 'Brief 12 Feb, p. 3' });
  });

  it('computes the candidate matrix from recorded evidence, one cell per requirement', () => {
    expect(answer.results).toHaveLength(2);
    const halden = answer.results[0];
    expect(halden?.productId).toBe('halden-task-chair');
    expect(halden?.results).toHaveLength(2);
    expect(halden?.results[0]?.verdict).toBe('meet'); // class B recorded
    expect(halden?.results[1]?.verdict).toBe('meet'); // black recorded
    expect(halden?.results[0]?.evidence[0]?.locator).toBe('p. 4, §2.1');
    const mera = answer.results[1];
    expect(mera?.results[0]?.verdict).toBe('fail'); // class C is not class B
    expect(mera?.results[1]?.verdict).toBe('unknown'); // no finish recorded
  });

  it('carries not-found distinctly and lists what would resolve it', () => {
    expect(
      answer.unknowns.some(
        (u) => u.status === 'not-found' && u.wouldResolve === 'the fire certificate'
      )
    ).toBe(true);
    // rec-ghost is null in the map: the reference does not resolve for this viewer.
    expect(
      answer.unknowns.some((u) => u.status === 'unresolved-ref' && u.recordId === 'rec-ghost')
    ).toBe(true);
  });

  it('keeps evidence one step from every claim, deduplicated and validated', () => {
    expect(answer.evidence.map((r) => r.id)).toEqual(['rec-1', 'rec-2', 'rec-finish']);
    expect(answer.evidence.every((r) => r.kind === 'value' || r.kind === 'passage')).toBe(true);
  });

  it('surfaces no conflicts when none exist', () => {
    expect(answer.conflicts).toHaveLength(0);
  });
});

describe('assembleAnswer — clarify and refuse render from checker outcomes', () => {
  it('a question back names the ambiguity and its readings; no matrix is computed', () => {
    const answer = assembleAnswer({
      draft: {
        outcome: 'clarify',
        interpretation: [],
        questionBack: {
          ambiguity: "'soundproof' can mean absorption, insulation, or impact",
          readings: [{ reading: 'absorption', whatItWouldChange: 'acoustic panels, NRC rating' }],
        },
        commentary: [],
        unknowns: [],
      },
      records: recordsMap,
      compare,
    });
    expect(answer.outcome).toBe('clarify');
    expect(answer.questionBack?.readings).toHaveLength(1);
    expect(answer.results).toHaveLength(0);
    expect(answer.requirements).toHaveLength(0);
  });

  it('a refusal carries its reason and nothing computed', () => {
    const answer = assembleAnswer({
      draft: {
        outcome: 'refuse',
        refusal: { status: 'not-found', reason: 'the library holds no ceiling documents' },
      },
      records: recordsMap,
      compare,
    });
    expect(answer.outcome).toBe('refuse');
    expect(answer.refusal?.reason).toContain('ceiling');
    expect(answer.results).toHaveLength(0);
  });
});

// --- Property tests: the boundary invariant under corruption -------------------
//
// A seeded LCG drives a generator of malformed drafts and poisoned record
// maps. For every input, the same invariant holds: the checker never asserts
// what the library does not hold.

const POISON: readonly unknown[] = [
  undefined,
  null,
  0,
  -1,
  4.2,
  '',
  '   ',
  'answer',
  true,
  [],
  [1, 2],
  { 1: 'x' },
  NaN,
];

class Lcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    // Numerical Recipes constants — deterministic across runs.
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    return this.state / 0x1_0000_0000;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

function corrupt(rng: Lcg, target: unknown, depth: number): unknown {
  const roll = rng.next();
  if (depth === 0 || roll < 0.2) return rng.pick(POISON);
  if (roll < 0.6 && typeof target === 'object' && target !== null && !Array.isArray(target)) {
    const copy: Record<string, unknown> = { ...target };
    const keys = Object.keys(copy);
    const key = rng.pick(keys.length > 0 ? keys : ['nonexistent']);
    copy[key] = corrupt(rng, copy[key], depth - 1);
    return copy;
  }
  if (roll < 0.8 && Array.isArray(target) && target.length > 0) {
    const copy = [...target];
    copy[Math.floor(rng.next() * copy.length)] = corrupt(
      rng,
      copy[Math.floor(rng.next() * copy.length)],
      depth - 1
    );
    return rng.chance(0.5) ? copy : copy.slice(0, Math.max(0, copy.length - 1));
  }
  return target;
}

function generatedRecord(rng: Lcg, id: string, index: number): unknown {
  if (rng.chance(0.25)) return rng.pick(POISON);
  const base = index % 2 === 0 ? value({ id }) : { ...meraValue, id };
  return corrupt(rng, base, 2);
}

function generatedInput(rng: Lcg): { draft: unknown; records: Map<string, LibraryRecord | null> } {
  const draft = corrupt(rng, goodDraft, 3);
  const records = new Map<string, LibraryRecord | null>();
  if (!rng.chance(0.15)) {
    for (let i = 0; i < 4; i++) {
      const id = `rec-${i}`;
      if (rng.chance(0.85)) records.set(id, generatedRecord(rng, id, i) as LibraryRecord | null);
      else records.set(id, null);
    }
  }
  return { draft, records };
}

/** Every record the answer shows is exactly a record the viewer's library held. */
function assertBoundaryHolds(
  answer: CheckedAnswer,
  records: ReadonlyMap<string, LibraryRecord | null>
): void {
  expect(['answer', 'clarify', 'refuse']).toContain(answer.outcome);
  const held = new Set([...records.keys()]);
  const shown = new Set<string>();
  for (const record of answer.evidence) {
    shown.add(record.id);
    expect(held.has(record.id)).toBe(true);
  }
  for (const row of answer.results) {
    for (const cell of row.results) {
      for (const record of cell.evidence) {
        shown.add(record.id);
        expect(held.has(record.id)).toBe(true);
        // Attribution: evidence belongs to the row's product — a draft cannot
        // re-attribute one product's record to another.
        if (record.kind === 'value') expect(record.productId).toBe(row.productId);
      }
    }
  }
  for (const id of shown) {
    const record = records.get(id);
    expect(record).toBeDefined();
    expect(record).not.toBeNull();
  }
  for (const unknown of answer.unknowns) {
    expect(unknown.reason.length).toBeGreaterThan(0);
    expect(unknown.wouldResolve.length).toBeGreaterThan(0);
  }
  if (answer.outcome === 'clarify')
    expect(answer.questionBack?.ambiguity.length ?? 0).toBeGreaterThan(0);
  if (answer.outcome === 'refuse') expect(answer.refusal?.reason.length ?? 0).toBeGreaterThan(0);
}

describe('assembleAnswer — property: nothing is asserted the library does not hold', () => {
  it('200 corrupted drafts and poisoned maps later, the boundary still holds', () => {
    const rng = new Lcg(0x5eed);
    for (let i = 0; i < 200; i++) {
      const { draft, records } = generatedInput(rng);
      const answer = assembleAnswer({ draft, records, compare });
      assertBoundaryHolds(answer, records);
    }
  });

  it('an empty library means every verdict is unknown — a draft asserts nothing alone', () => {
    const rng = new Lcg(0xc0ffee);
    for (let i = 0; i < 50; i++) {
      const draft = corrupt(rng, goodDraft, 3);
      const answer = assembleAnswer({ draft, records: new Map(), compare });
      for (const row of answer.results) {
        for (const cell of row.results) {
          expect(cell.verdict).toBe('unknown');
          expect(cell.evidence).toHaveLength(0);
        }
      }
      expect(answer.evidence).toHaveLength(0);
    }
  });

  it('determinism: the same input assembles to the same answer', () => {
    const rngA = new Lcg(1234);
    const rngB = new Lcg(1234);
    const a = assembleAnswer({ draft: corrupt(rngA, goodDraft, 3), records: recordsMap, compare });
    const b = assembleAnswer({ draft: corrupt(rngB, goodDraft, 3), records: recordsMap, compare });
    expect(b).toEqual(a);
  });
});
