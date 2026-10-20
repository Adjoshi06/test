import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { decideComparability, orderedMethods } from '@/lib/registry/comparability';
import { RegistryIntegrityError, RegistryNotFoundError } from '@/lib/registry/errors';
import { RegistryService } from '@/lib/registry/service';

describe('comparability — the pure rule', () => {
  it('a method compared with itself needs no edge', () => {
    const decision = decideComparability('astm-e84', 'astm-e84', null);
    expect(decision).toMatchObject({ verdict: 'comparable', basis: 'same-method' });
  });

  it('an explicit edge grants comparability and carries its why', () => {
    const decision = decideComparability('en-13501-1:2007', 'en-13501-1:2018', {
      comparable: true,
      note: 'successive editions of one scheme',
    });
    expect(decision).toMatchObject({ verdict: 'comparable', basis: 'explicit-edge' });
    expect(decision.reason).toContain('successive editions');
  });

  it('a recorded incomparability is not-comparable, with the account as the reason', () => {
    const decision = decideComparability('astm-e84', 'en-13501-1:2018', {
      comparable: false,
      note: 'a Euroclass is not an E84 class',
    });
    expect(decision).toMatchObject({ verdict: 'not-comparable', basis: 'known-incomparable' });
    expect(decision.reason).toContain('a Euroclass is not an E84 class');
  });

  it('a pair with no edge is refused, never assumed', () => {
    const decision = decideComparability('astm-e84', 'en-13501-1:2018', null);
    expect(decision).toMatchObject({ verdict: 'not-comparable', basis: 'no-edge' });
    expect(decision.reason).toContain('must not be set side by side');
  });

  it('the verdict is symmetric in call order', () => {
    const edge = { comparable: false, note: 'n' };
    expect(decideComparability('a', 'b', edge).verdict).toBe(
      decideComparability('b', 'a', edge).verdict
    );
    expect(decideComparability('a', 'b', null).verdict).toBe(
      decideComparability('b', 'a', null).verdict
    );
  });

  it('orderedMethods returns the canonical direction, both ways round', () => {
    expect(orderedMethods('astm-e84', 'en-13501-1:2018')).toEqual(['astm-e84', 'en-13501-1:2018']);
    expect(orderedMethods('en-13501-1:2018', 'astm-e84')).toEqual(['astm-e84', 'en-13501-1:2018']);
  });
});

describe('comparability — the service over the seeded account', () => {
  let db: LibraryDb;
  let registry: RegistryService;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE methods, method_edges CASCADE`);
    registry = new RegistryService(db);
    await registry.seed();
  });

  it('an edge present grants comparability — two editions of one method', async () => {
    const decision = await registry.compareMethods('en-13501-1:2007', 'en-13501-1:2018');
    expect(decision.verdict).toBe('comparable');
    expect(decision.basis).toBe('explicit-edge');
  });

  it('the seeded named pair is known not comparable — Euroclass vs E84 class', async () => {
    const decision = await registry.compareMethods('en-13501-1:2018', 'astm-e84');
    expect(decision.verdict).toBe('not-comparable');
    expect(decision.basis).toBe('known-incomparable');
  });

  it('an absent edge is refused even when the quantities match', async () => {
    // E648 and the Euroclasses both address 'fire-performance' — which is
    // exactly the trap: a matching quantity never confers comparability.
    const e648 = await registry.getMethod('astm-e648');
    const euroclass = await registry.getMethod('en-13501-1:2018');
    expect(e648?.quantity).toBe(euroclass?.quantity);

    const decision = await registry.compareMethods('astm-e648', 'en-13501-1:2018');
    expect(decision).toMatchObject({ verdict: 'not-comparable', basis: 'no-edge' });
  });

  it('a method compared with itself is comparable without an edge', async () => {
    const decision = await registry.compareMethods('astm-e84', 'astm-e84');
    expect(decision).toMatchObject({ verdict: 'comparable', basis: 'same-method' });
  });

  it('comparison is symmetric through the service', async () => {
    const forward = await registry.compareMethods('astm-e84', 'en-13501-1:2007');
    const backward = await registry.compareMethods('en-13501-1:2007', 'astm-e84');
    expect(forward).toMatchObject({ verdict: 'not-comparable' });
    expect(forward.verdict).toBe(backward.verdict);
    expect(forward.basis).toBe(backward.basis);
  });

  it('an unregistered method id throws — an integrity gap, not an outcome', async () => {
    await expect(registry.compareMethods('made-up', 'astm-e84')).rejects.toThrow(
      RegistryNotFoundError
    );
    // Even a self-comparison cannot bless an unregistered id.
    await expect(registry.compareMethods('made-up', 'made-up')).rejects.toThrow(
      RegistryNotFoundError
    );
  });

  it('empty ids are rejected outright', async () => {
    await expect(registry.compareMethods('  ', 'astm-e84')).rejects.toThrow(RegistryIntegrityError);
    await expect(registry.compareMethods('astm-e84', '')).rejects.toThrow(RegistryIntegrityError);
  });
});
