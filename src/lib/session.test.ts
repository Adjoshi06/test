import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { SeededEmailProvider } from '@/lib/auth/email-provider';
import { AuthService } from '@/lib/auth/service';
import { seedFirmUsers } from '@/lib/auth/seed';

/**
 * Hoisted holders the mock factories write into before the module under test
 * is imported: the seam's database and a mutable request cookie store.
 */
const harness = vi.hoisted(() => ({
  db: undefined as unknown as LibraryDb,
  cookies: new Map<string, string>(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = harness.cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
  }),
}));

vi.mock('@/lib/seed', async () => {
  const { createDb } = await import('@/db/client');
  const { runMigrations } = await import('@/db/migrate');
  const db = createDb();
  harness.db = db;
  let booted: Promise<void> | undefined;
  return {
    // Boot caching, as the real seed does: migrations run once per process.
    ensureDevSeed: () => (booted ??= runMigrations(db)),
    getAppDb: () => db,
  };
});

const { SESSION_COOKIE_NAME, getSessionLibrary, getViewer } = await import('./session');

/**
 * The seam the pages render through, with the real session chain behind it:
 * cookie → AuthService resolution → viewer-scoped LibraryService. Unauthenticated
 * requests resolve to no viewer, and the library returns nothing — at the seam,
 * not only in the service's own tests.
 */
describe('session resolution', () => {
  let auth: AuthService;

  beforeEach(async () => {
    const db = harness.db;
    await runMigrations(db);
    await db.execute(
      sql`TRUNCATE users, sessions, documents, passages, extracted_values, products CASCADE`
    );
    harness.cookies.clear();
    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada' }]);
    auth = new AuthService(db, new SeededEmailProvider(db));
  });

  it('a valid session cookie resolves to the signed-in viewer and their library', async () => {
    const result = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    if (result === null) {
      throw new Error('expected sign-in to succeed');
    }
    const library = new (await import('@/lib/library/service')).LibraryService(
      harness.db,
      result.user
    );
    await library.createDocument({ title: 'Ada — spec', kind: 'product-doc' });
    harness.cookies.set(SESSION_COOKIE_NAME, result.session.token);

    const viewer = await getViewer();
    expect(viewer?.userId).toBe(result.user.userId);

    const sessionLibrary = await getSessionLibrary();
    const documents = await sessionLibrary.listDocuments();
    expect(documents).toHaveLength(1);
    expect(documents[0]?.ownerId).toBe(result.user.userId);
  });

  it('no cookie — an unauthenticated request — resolves to no viewer and an empty library', async () => {
    const sessionLibrary = await getSessionLibrary();
    expect(await getViewer()).toBeNull();
    expect(await sessionLibrary.listDocuments()).toEqual([]);
    expect(await sessionLibrary.listValues()).toEqual([]);
  });

  it('a token that is not a session — unknown, expired, or signed out — is no viewer', async () => {
    const result = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    if (result === null) {
      throw new Error('expected sign-in to succeed');
    }

    // Unknown token.
    harness.cookies.set(SESSION_COOKIE_NAME, 'not-a-real-session-token');
    expect(await getViewer()).toBeNull();

    // Expired: end the session by expiry, then the same cookie is dead.
    harness.cookies.set(SESSION_COOKIE_NAME, result.session.token);
    await harness.db.execute(
      sql`UPDATE sessions SET expires_at = now() - interval '1 second' WHERE token_hash = (SELECT token_hash FROM sessions LIMIT 1)`
    );
    expect(await getViewer()).toBeNull();

    // Signed out.
    const fresh = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    if (fresh === null) {
      throw new Error('expected re-sign-in to succeed');
    }
    harness.cookies.set(SESSION_COOKIE_NAME, fresh.session.token);
    await auth.signOut(fresh.session.token);
    expect(await getViewer()).toBeNull();
  });
});
