import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { extractedValues, passages, users } from '@/db/schema';
import {
  LibraryAccessError,
  LibraryIntegrityError,
  LibraryNotFoundError,
} from '@/lib/library/errors';
import { LibraryService } from '@/lib/library/service';
import type { NewValue, VerificationState } from '@/lib/library/types';

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('expected a row, got none');
  }
  return row;
}

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

describe('library and evidence model', () => {
  let db: LibraryDb;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    // Tests within this file run sequentially, so a shared in-memory Postgres
    // with a per-test truncate keeps the suite fast and race-free.
    await db.execute(sql`TRUNCATE users, documents, passages, extracted_values CASCADE`);
  });

  async function seedUser(email: string): Promise<{ id: string }> {
    return first(
      await db.insert(users).values({ email, displayName: email }).returning({ id: users.id })
    );
  }

  interface Seed {
    userId: string;
    documentId: string;
    passageId: string;
  }

  /** User with one document ("Halden task chair spec") and one passage. */
  async function seedLibrary(email: string): Promise<Seed> {
    const service = new LibraryService(db, { userId: (await seedUser(email)).id });
    const document = await service.createDocument({
      title: 'Halden task chair — manufacturer specification',
      kind: 'product-doc',
    });
    const passage = await service.addPassage({
      documentId: document.id,
      locator: 'p. 4, §2.1',
      quote: 'Seat height adjustable 42–55 cm, gas-lift class 4.',
    });
    return { userId: document.ownerId, documentId: document.id, passageId: passage.id };
  }

  describe('integrity — a value cannot persist without its evidence', () => {
    it('records a value whose evidence chain is complete', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      const verifier = (await seedUser('reviewer@firm.test')).id;

      const value = await service.recordValue({
        passageId: seed.passageId,
        propertyId: 'seat-height-range',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'en-527-1',
        authority: 'product-doc',
        verification: 'human-verified',
        verifiedBy: verifier,
      });

      expect(value.propertyId).toBe('seat-height-range');
      expect(value.verification).toBe('human-verified');
      expect(value.verifiedBy).toBe(verifier);
      expect(value.ownerId).toBe(seed.userId);
    });

    it('the engine rejects a value whose passage does not exist (orphan)', async () => {
      const seed = await seedLibrary('a@firm.test');
      const err = await engineRejection(
        db.insert(extractedValues).values({
          passageId: randomUUID(),
          ownerId: seed.userId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'interpreted',
        })
      );
      expect(err.message).toMatch(/extracted_values_passage_owner_fkey/);
    });

    it('the service rejects a value on an unknown passage', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      await expect(
        service.recordValue({
          passageId: randomUUID(),
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'interpreted',
        })
      ).rejects.toThrow(LibraryNotFoundError);
    });

    it('a passage cannot be written without a locator and a verbatim quote', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      await expect(
        service.addPassage({ documentId: seed.documentId, locator: '   ', quote: 'quoted text' })
      ).rejects.toThrow(LibraryIntegrityError);
      await expect(
        service.addPassage({ documentId: seed.documentId, locator: 'p. 5', quote: '   ' })
      ).rejects.toThrow(LibraryIntegrityError);

      // The engine holds the same line even when the service is bypassed.
      const err = await engineRejection(
        db.insert(passages).values({
          documentId: seed.documentId,
          ownerId: seed.userId,
          locator: 'p. 5',
          quote: '',
        })
      );
      expect(err.message).toMatch(/passages_quote_nonempty/);
    });

    it('a value cannot be written without property, raw, and method', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      for (const patch of [{ propertyId: '  ' }, { raw: '  ' }, { methodId: '' }] as const) {
        await expect(
          service.recordValue({
            passageId: seed.passageId,
            propertyId: 'fire-rating',
            raw: 'B-s1,d0',
            methodId: 'en-13501-1',
            authority: 'product-doc',
            verification: 'interpreted',
            ...patch,
          })
        ).rejects.toThrow(LibraryIntegrityError);
      }
    });

    it('a passage cannot attach to another owner’s document (tenancy)', async () => {
      const a = await seedLibrary('a@firm.test');
      const b = await seedLibrary('b@firm.test');
      const serviceB = new LibraryService(db, { userId: b.userId });
      // B cannot see A's document — the attempt is "not found", never a leak.
      await expect(
        serviceB.addPassage({ documentId: a.documentId, locator: 'p. 1', quote: 'x' })
      ).rejects.toThrow(LibraryNotFoundError);
      // And a raw insert through the engine is rejected by the composite FK.
      const err = await engineRejection(
        db.insert(passages).values({
          documentId: a.documentId,
          ownerId: b.userId,
          locator: 'p. 1',
          quote: 'x',
        })
      );
      expect(err.message).toMatch(/passages_document_owner_fkey/);
    });

    it('a value cannot sit on another owner’s passage (tenancy)', async () => {
      const a = await seedLibrary('a@firm.test');
      const b = await seedLibrary('b@firm.test');
      const serviceB = new LibraryService(db, { userId: b.userId });
      await expect(
        serviceB.recordValue({
          passageId: a.passageId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'interpreted',
        })
      ).rejects.toThrow(LibraryNotFoundError);
    });

    it('a locator addresses exactly one passage per document', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      await expect(
        service.addPassage({
          documentId: seed.documentId,
          locator: 'p. 4, §2.1',
          quote: 'A different quote at the same place.',
        })
      ).rejects.toThrow(/locator/);
    });
  });

  describe('verification states are a closed set, typed', () => {
    it('the VerificationState union is exactly the three engine states', () => {
      expectTypeOf<VerificationState>().toEqualTypeOf<
        'human-verified' | 'interpreted' | 'machine-read'
      >();
      expectTypeOf<NewValue['verification']>().toEqualTypeOf<VerificationState>();
    });

    it('does not type-check a human-verified value without a verifier id', () => {
      // @ts-expect-error — human-verified requires verifiedBy; if the union is
      // loosened, this line stops erroring and typecheck fails the build.
      const bad: NewValue = {
        passageId: 'p',
        propertyId: 'fire-rating',
        raw: 'B-s1,d0',
        methodId: 'en-13501-1',
        authority: 'product-doc',
        verification: 'human-verified',
      };
      expect(bad.verification).toBe('human-verified');
    });

    it('does not type-check a verifier id on an interpreted value', () => {
      // @ts-expect-error — verifiedBy belongs only to human-verified values.
      const bad: NewValue = {
        passageId: 'p',
        propertyId: 'fire-rating',
        raw: 'B-s1,d0',
        methodId: 'en-13501-1',
        authority: 'product-doc',
        verification: 'interpreted',
        verifiedBy: 'someone',
      };
      expect(bad.verification).toBe('interpreted');
    });

    it('the engine rejects human-verified without a verifier id, both ways', async () => {
      const seed = await seedLibrary('a@firm.test');
      // Drizzle's per-column insert types cannot correlate the two fields, so
      // this compiles — and the engine CHECK is what rejects it. Exactly why
      // the service layer adds the correlated union on top.
      const noVerifier = await engineRejection(
        db.insert(extractedValues).values({
          passageId: seed.passageId,
          ownerId: seed.userId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'human-verified',
          verifiedBy: null,
        })
      );
      expect(noVerifier.message).toMatch(/extracted_values_verifier_matches_state/);

      const reviewer = (await seedUser('reviewer@firm.test')).id;
      const verifierOnInterpreted = await engineRejection(
        db.insert(extractedValues).values({
          passageId: seed.passageId,
          ownerId: seed.userId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'interpreted',
          verifiedBy: reviewer,
        })
      );
      expect(verifierOnInterpreted.message).toMatch(/extracted_values_verifier_matches_state/);
    });

    it('the service rejects a cast human-verified value without a verifier id', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      const input = {
        passageId: seed.passageId,
        propertyId: 'fire-rating',
        raw: 'B-s1,d0',
        methodId: 'en-13501-1',
        authority: 'product-doc',
        verification: 'human-verified',
      } as NewValue; // a cast caller bypassing the union
      await expect(service.recordValue(input)).rejects.toThrow(LibraryIntegrityError);
    });

    it('the engine rejects states and authorities outside the closed sets', async () => {
      const seed = await seedLibrary('a@firm.test');
      const badState = await engineRejection(
        db.insert(extractedValues).values({
          passageId: seed.passageId,
          ownerId: seed.userId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'checked' as VerificationState, // bypassing the union
        })
      );
      expect(badState.message).toMatch(/verification_state/);

      const badAuthority = await engineRejection(
        db.insert(extractedValues).values({
          passageId: seed.passageId,
          ownerId: seed.userId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'opinion' as 'product-doc', // bypassing the union
          verification: 'interpreted',
        })
      );
      expect(badAuthority.message).toMatch(/authority/);
    });

    it('a verifier must be an existing user', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      await expect(
        service.recordValue({
          passageId: seed.passageId,
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'human-verified',
          verifiedBy: randomUUID(),
        })
      ).rejects.toThrow(/verifier/);
    });

    it('an interpreted value carries no verifier id', async () => {
      const seed = await seedLibrary('a@firm.test');
      const service = new LibraryService(db, { userId: seed.userId });
      const value = await service.recordValue({
        passageId: seed.passageId,
        propertyId: 'fire-rating',
        raw: 'B-s1,d0',
        methodId: 'en-13501-1',
        authority: 'product-doc',
        verification: 'interpreted',
      });
      expect(value.verification).toBe('interpreted');
      expect(value.verifiedBy).toBeNull();
    });
  });

  describe('query layer — per-user visibility', () => {
    it('shows user A only their own material, and B theirs', async () => {
      const a = await seedLibrary('a@firm.test');
      const b = await seedLibrary('b@firm.test');
      const serviceA = new LibraryService(db, { userId: a.userId });
      const serviceB = new LibraryService(db, { userId: b.userId });

      const aDocuments = await serviceA.listDocuments();
      const bDocuments = await serviceB.listDocuments();
      expect(aDocuments).toHaveLength(1);
      expect(aDocuments[0]?.id).toBe(a.documentId);
      expect(bDocuments).toHaveLength(1);
      expect(bDocuments[0]?.id).toBe(b.documentId);

      const aValues = await serviceA.listValues();
      expect(aValues).toHaveLength(0);
      await serviceA.recordValue({
        passageId: a.passageId,
        propertyId: 'seat-height-range',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'en-527-1',
        authority: 'product-doc',
        verification: 'interpreted',
      });
      expect(await serviceA.listValues()).toHaveLength(1);
      expect(await serviceB.listValues()).toHaveLength(0);
    });

    it('a foreign document is indistinguishable from a missing one', async () => {
      const a = await seedLibrary('a@firm.test');
      const b = await seedLibrary('b@firm.test');
      const serviceA = new LibraryService(db, { userId: a.userId });
      const serviceB = new LibraryService(db, { userId: b.userId });

      expect(await serviceB.getDocument(a.documentId)).toBeNull();
      expect(await serviceA.getDocument(a.documentId)).not.toBeNull();
      expect(await serviceA.getDocument(randomUUID())).toBeNull();
    });

    it('getDocument returns the document with its evidence, and only its evidence', async () => {
      const a = await seedLibrary('a@firm.test');
      const serviceA = new LibraryService(db, { userId: a.userId });
      const value = await serviceA.recordValue({
        passageId: a.passageId,
        propertyId: 'seat-height-range',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'en-527-1',
        authority: 'product-doc',
        verification: 'interpreted',
      });
      const b = await seedLibrary('b@firm.test');
      const serviceB = new LibraryService(db, { userId: b.userId });
      await serviceB.recordValue({
        passageId: b.passageId,
        propertyId: 'seat-height-range',
        raw: 'Seat height 40–50 cm',
        methodId: 'en-527-1',
        authority: 'product-doc',
        verification: 'interpreted',
      });

      const view = await serviceA.getDocument(a.documentId);
      expect(view).not.toBeNull();
      expect(view?.document.title).toContain('Halden');
      expect(view?.passages).toHaveLength(1);
      expect(view?.passages[0]?.quote).toContain('42–55 cm');
      expect(view?.values).toHaveLength(1);
      expect(view?.values[0]?.id).toBe(value.id);
      expect(view?.values[0]?.methodId).toBe('en-527-1');
    });

    it('an unauthenticated caller gets nothing, and cannot write', async () => {
      await seedLibrary('a@firm.test');
      const anonymous = new LibraryService(db, null);

      expect(await anonymous.listDocuments()).toEqual([]);
      expect(await anonymous.listValues()).toEqual([]);
      expect(await anonymous.getDocument(randomUUID())).toBeNull();

      await expect(
        anonymous.createDocument({ title: 'sneaky', kind: 'product-doc' })
      ).rejects.toThrow(LibraryAccessError);
      await expect(
        anonymous.addPassage({ documentId: randomUUID(), locator: 'p. 1', quote: 'x' })
      ).rejects.toThrow(LibraryAccessError);
      await expect(
        anonymous.recordValue({
          passageId: randomUUID(),
          propertyId: 'fire-rating',
          raw: 'B-s1,d0',
          methodId: 'en-13501-1',
          authority: 'product-doc',
          verification: 'interpreted',
        })
      ).rejects.toThrow(LibraryAccessError);
    });
  });
});
