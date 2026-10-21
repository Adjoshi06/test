import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { AuthService } from '@/lib/auth/service';
import { SeededEmailProvider } from '@/lib/auth/email-provider';
import { SESSION_TTL_MS } from '@/lib/auth/session';
import { seedFirmUsers } from '@/lib/auth/seed';
import { LibraryAccessError } from '@/lib/library/errors';
import { LibraryService } from '@/lib/library/service';
import { ViewerScopedSearch } from '@/lib/reasoner/scoped-search';
import { FakeLibrarySearch } from '@/lib/reasoner/search';
import type { LibraryRecord } from '@/lib/reasoner/types';

/**
 * Sign-in and per-user visibility, proven at the query layer — not the UI
 * (spec art_Ene8eA8R, acceptance evidence for "Sign-in and visibility"):
 * unauthenticated requests return nothing, and user A's material is
 * invisible to user B. The chain is the real one a request walks: sign in,
 * resolve the session token to a viewer, and hand that viewer to the
 * library service and the model's scoped search tool.
 */
describe('sign-in and per-user visibility', () => {
  let db: LibraryDb;
  /** Mutable clock — expiry tests advance it instead of sleeping. */
  let now: Date;
  let auth: AuthService;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, sessions, documents, passages, extracted_values CASCADE`);
    now = new Date('2026-10-20T12:00:00.000Z');
    auth = new AuthService(db, new SeededEmailProvider(db), () => now);
    await seedFirmUsers(db, [
      { email: 'a@firm.test', displayName: 'User A' },
      { email: 'b@firm.test', displayName: 'User B' },
    ]);
  });

  interface Session {
    token: string;
    userId: string;
    valueId: string;
  }

  /** Sign in as a seeded firm user and seed their library through their viewer. */
  async function signInAndSeed(email: string, documentTitle: string): Promise<Session> {
    const result = await auth.signIn({ kind: 'email', email });
    if (result === null) {
      throw new Error(`expected ${email} to sign in`);
    }
    const viewer = await auth.viewerFromToken(result.session.token);
    if (viewer === null) {
      throw new Error(`expected ${email}'s session to resolve`);
    }
    const library = new LibraryService(db, viewer);
    const document = await library.createDocument({ title: documentTitle, kind: 'product-doc' });
    const passage = await library.addPassage({
      documentId: document.id,
      locator: 'p. 4, §2.1',
      quote: 'Seat height adjustable 42–55 cm, gas-lift class 4.',
    });
    const value = await library.recordValue({
      passageId: passage.id,
      propertyId: 'seat-height-range',
      raw: 'Seat height adjustable 42–55 cm',
      methodId: 'en-527-1',
      authority: 'product-doc',
      verification: 'interpreted',
    });
    return { token: result.session.token, userId: result.user.userId, valueId: value.id };
  }

  it('each signed-in user sees only their own material', async () => {
    const a = await signInAndSeed('a@firm.test', 'A — Halden task chair spec');
    const b = await signInAndSeed('b@firm.test', 'B — Mera conference chair spec');

    const viewerA = await auth.viewerFromToken(a.token);
    const viewerB = await auth.viewerFromToken(b.token);
    if (viewerA === null || viewerB === null) {
      throw new Error('expected both sessions to resolve');
    }
    const libraryA = new LibraryService(db, viewerA);
    const libraryB = new LibraryService(db, viewerB);

    const aDocuments = await libraryA.listDocuments();
    expect(aDocuments).toHaveLength(1);
    expect(aDocuments[0]?.title).toContain('A —');
    expect(aDocuments[0]?.ownerId).toBe(a.userId);

    const bDocuments = await libraryB.listDocuments();
    expect(bDocuments).toHaveLength(1);
    expect(bDocuments[0]?.title).toContain('B —');

    // Each value list is exactly the viewer's own value — never the other's.
    const aValues = await libraryA.listValues();
    const bValues = await libraryB.listValues();
    expect(aValues.map((v) => v.id)).toEqual([a.valueId]);
    expect(bValues.map((v) => v.id)).toEqual([b.valueId]);
    expect(aValues.some((v) => v.ownerId !== a.userId)).toBe(false);
    expect(bValues.some((v) => v.ownerId !== b.userId)).toBe(false);

    // Each document is unreachable for the other viewer.
    expect(await libraryB.getDocument(aDocuments[0]?.id ?? randomUUID())).toBeNull();
    expect(await libraryA.getDocument(bDocuments[0]?.id ?? randomUUID())).toBeNull();
  });

  it('an unauthenticated request — no token — resolves to no viewer and gets nothing', async () => {
    await signInAndSeed('a@firm.test', 'A — Halden task chair spec');

    const viewer = await auth.viewerFromToken(undefined);
    expect(viewer).toBeNull();

    const anonymous = new LibraryService(db, viewer);
    expect(await anonymous.listDocuments()).toEqual([]);
    expect(await anonymous.listValues()).toEqual([]);
    expect(await anonymous.getDocument(randomUUID())).toBeNull();
    await expect(
      anonymous.createDocument({ title: 'sneaky', kind: 'product-doc' })
    ).rejects.toThrow(LibraryAccessError);
  });

  it('an unknown token is not a viewer — nothing is returned', async () => {
    await signInAndSeed('a@firm.test', 'A — Halden task chair spec');

    const viewer = await auth.viewerFromToken(randomUUID());
    expect(viewer).toBeNull();
    expect(await new LibraryService(db, viewer).listDocuments()).toEqual([]);
  });

  it('an expired session resolves to no viewer — its material is unreachable', async () => {
    const a = await signInAndSeed('a@firm.test', 'A — Halden task chair spec');
    now = new Date(now.getTime() + SESSION_TTL_MS + 1);

    const viewer = await auth.viewerFromToken(a.token);
    expect(viewer).toBeNull();
    expect(await new LibraryService(db, viewer).listDocuments()).toEqual([]);
    expect(await new LibraryService(db, viewer).listValues()).toEqual([]);
  });

  it('sign-out ends the session — the token is dead afterwards', async () => {
    const a = await signInAndSeed('a@firm.test', 'A — Halden task chair spec');

    await auth.signOut(a.token);
    const viewer = await auth.viewerFromToken(a.token);
    expect(viewer).toBeNull();
    expect(await new LibraryService(db, viewer).listDocuments()).toEqual([]);
  });

  it('an unauthenticated request never reaches the model through the search tool', async () => {
    const seed: LibraryRecord[] = [
      {
        id: 'rec-halden-seat-height',
        kind: 'value',
        authority: 'product-doc',
        verification: 'interpreted',
        documentId: 'doc-halden-spec',
        documentTitle: 'A — Halden task chair spec',
        locator: 'p. 4, §2.1',
        quote: 'Seat height adjustable 42–55 cm, gas-lift class 4.',
        productId: 'halden-task-chair',
        propertyId: 'seat-height-range',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'en-527-1',
      },
    ];
    const scoped = new ViewerScopedSearch(new FakeLibrarySearch(seed), null);

    // Records exist in the library; the unauthenticated request still sees none.
    const result = await scoped.search({ terms: 'halden' });
    expect(result).toEqual({ records: [] });
  });

  it('sign-in matches the seeded email case-insensitively — one user, one address', async () => {
    const a = await signInAndSeed('a@firm.test', 'A — Halden task chair spec');

    const again = await auth.signIn({ kind: 'email', email: 'A@FIRM.TEST' });
    expect(again?.user.userId).toBe(a.userId);
  });
});
