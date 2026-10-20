import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { methodEdges, methods } from '@/db/schema';
import { RegistryIntegrityError, RegistryNotFoundError } from '@/lib/registry/errors';
import { RegistryService } from '@/lib/registry/service';
import { REGISTRY_SEED } from '@/lib/registry/seed-data';

/** The engine error underneath Drizzle's DrizzleQueryError wrapper. */
async function engineRejection(query: Promise<unknown>): Promise<Error> {
  try {
    await query;
    throw new Error('expected the query to fail');
  } catch (e) {
    let current: unknown = e;
    while (current instanceof Error && current.cause !== undefined && current.cause !== null) {
      current = current.cause;
    }
    expect(current).toBeInstanceOf(Error);
    return current as Error;
  }
}

describe('methods registry', () => {
  let db: LibraryDb;
  let registry: RegistryService;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE methods, method_edges CASCADE`);
    registry = new RegistryService(db);
  });

  describe('the account of which methods exist', () => {
    it('registers a method and reads it back', async () => {
      const method = await registry.defineMethod({
        id: 'method-a',
        name: 'Method A — a classification scheme',
        kind: 'classification',
        quantity: 'property-a',
        edition: '2018',
      });

      expect(method.id).toBe('method-a');
      expect(method.edition).toBe('2018');
      expect((await registry.getMethod('method-a'))?.id).toBe('method-a');
      expect(await registry.getMethod('method-b')).toBeNull();
    });

    it('lists methods in canonical id order', async () => {
      await registry.defineMethod({
        id: 'method-b',
        name: 'B',
        kind: 'measurement',
        quantity: 'q',
      });
      await registry.defineMethod({
        id: 'method-a',
        name: 'A',
        kind: 'measurement',
        quantity: 'q',
      });
      const ids = (await registry.listMethods()).map((m) => m.id);
      expect(ids).toEqual(['method-a', 'method-b']);
    });

    it('refuses empty fields at the service layer', async () => {
      await expect(
        registry.defineMethod({ id: '  ', name: 'A', kind: 'measurement', quantity: 'q' })
      ).rejects.toThrow(RegistryIntegrityError);
      await expect(
        registry.defineMethod({ id: 'method-a', name: '   ', kind: 'measurement', quantity: 'q' })
      ).rejects.toThrow(RegistryIntegrityError);
      await expect(
        registry.defineMethod({ id: 'method-a', name: 'A', kind: 'measurement', quantity: ' ' })
      ).rejects.toThrow(RegistryIntegrityError);
    });

    it('refuses non-lowercase ids — the cited spelling must be canonical', async () => {
      await expect(
        registry.defineMethod({ id: 'Method-A', name: 'A', kind: 'measurement', quantity: 'q' })
      ).rejects.toThrow(RegistryIntegrityError);

      // The engine holds the same line even when the service is bypassed.
      const err = await engineRejection(
        db.insert(methods).values({ id: 'Method-A', name: 'A', kind: 'measurement', quantity: 'q' })
      );
      expect(err.message).toMatch(/methods_id_lowercase/);
    });

    it('the engine rejects a duplicate method id', async () => {
      await registry.defineMethod({
        id: 'method-a',
        name: 'A',
        kind: 'measurement',
        quantity: 'q',
      });
      const err = await engineRejection(
        db
          .insert(methods)
          .values({ id: 'method-a', name: 'A again', kind: 'measurement', quantity: 'q' })
      );
      expect(err.message).toMatch(/methods_pkey/);
    });
  });

  describe('comparability edges', () => {
    beforeEach(async () => {
      await registry.defineMethod({
        id: 'method-a',
        name: 'A',
        kind: 'measurement',
        quantity: 'q',
      });
      await registry.defineMethod({
        id: 'method-b',
        name: 'B',
        kind: 'measurement',
        quantity: 'q',
      });
    });

    it('stores one row per pair in canonical direction, whatever order arrives', async () => {
      await registry.defineEdge({
        fromMethodId: 'method-b',
        toMethodId: 'method-a',
        comparable: true,
        note: 'successive editions of one scheme',
      });
      const edges = await registry.listEdges();
      expect(edges).toHaveLength(1);
      expect(edges[0]?.fromMethodId).toBe('method-a');
      expect(edges[0]?.toMethodId).toBe('method-b');
    });

    it('refuses a self-edge at the service and the engine', async () => {
      await expect(
        registry.defineEdge({
          fromMethodId: 'method-a',
          toMethodId: 'method-a',
          comparable: true,
          note: 'n',
        })
      ).rejects.toThrow(RegistryIntegrityError);

      const err = await engineRejection(
        db
          .insert(methodEdges)
          .values({ fromMethodId: 'method-a', toMethodId: 'method-a', comparable: true, note: 'n' })
      );
      expect(err.message).toMatch(/method_edges_canonical_direction/);
    });

    it('refuses an edge naming an unregistered method', async () => {
      await expect(
        registry.defineEdge({
          fromMethodId: 'method-a',
          toMethodId: 'method-c',
          comparable: true,
          note: 'n',
        })
      ).rejects.toThrow(RegistryNotFoundError);

      const err = await engineRejection(
        db
          .insert(methodEdges)
          .values({ fromMethodId: 'method-a', toMethodId: 'method-c', comparable: true, note: 'n' })
      );
      // Postgres fires one of the two edge foreign keys — either rejection
      // holds the same line: both ends must be registered methods.
      expect(err.message).toMatch(/method_edges_(from|to)_method_id_methods_id_fk/);
    });

    it('refuses a second edge for the same pair', async () => {
      const edge = {
        fromMethodId: 'method-a',
        toMethodId: 'method-b',
        comparable: true,
        note: 'n',
      };
      await registry.defineEdge(edge);
      await expect(registry.defineEdge(edge)).rejects.toThrow(RegistryIntegrityError);
    });

    it('refuses an edge without its why', async () => {
      await expect(
        registry.defineEdge({
          fromMethodId: 'method-a',
          toMethodId: 'method-b',
          comparable: true,
          note: '  ',
        })
      ).rejects.toThrow(RegistryIntegrityError);

      const err = await engineRejection(
        db
          .insert(methodEdges)
          .values({ fromMethodId: 'method-a', toMethodId: 'method-b', comparable: true, note: ' ' })
      );
      expect(err.message).toMatch(/method_edges_note_nonempty/);
    });
  });

  describe('the seeded account', () => {
    it('seeds the spec’s named pairs', async () => {
      await registry.seed();

      const registered = await registry.listMethods();
      expect(registered.map((m) => m.id)).toEqual([
        'astm-e648',
        'astm-e84',
        'en-13501-1:2007',
        'en-13501-1:2018',
      ]);

      const edges = await registry.listEdges();
      expect(edges).toHaveLength(3);
      const byPair = new Map(
        edges.map((e) => [`${e.fromMethodId} -> ${e.toMethodId}`, e.comparable])
      );
      // Two editions of one method: comparable.
      expect(byPair.get('en-13501-1:2007 -> en-13501-1:2018')).toBe(true);
      // Euroclasses vs E84 classes: known not comparable, either edition.
      expect(byPair.get('astm-e84 -> en-13501-1:2007')).toBe(false);
      expect(byPair.get('astm-e84 -> en-13501-1:2018')).toBe(false);
    });

    it('re-seeding changes nothing', async () => {
      await registry.seed();
      await registry.seed();
      expect(await registry.listMethods()).toHaveLength(REGISTRY_SEED.methods.length);
      expect(await registry.listEdges()).toHaveLength(REGISTRY_SEED.edges.length);
    });
  });
});
