import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { users } from '@/db/schema';
import { SeededEmailProvider } from './email-provider';
import type { IdentityProvider, ProviderUser, SignInInput } from './provider';
import { AuthService } from './service';
import { seedFirmUsers } from './seed';

/**
 * A second provider implementation — proof the seam is real: the service is
 * constructed the same way for any provider, and Google OAuth can land later
 * without touching sign-in or session code.
 */
class RosterProvider implements IdentityProvider {
  constructor(private readonly db: LibraryDb) {}

  async authenticate(input: SignInInput): Promise<ProviderUser | null> {
    if (input.kind !== 'email') {
      return null;
    }
    const email = input.email.trim().toLowerCase();
    const rows = await this.db.select().from(users);
    const match = rows.find((row) => row.email === email);
    return match ? { userId: match.id, email: match.email, displayName: match.displayName } : null;
  }
}

describe('AuthService', () => {
  let db: LibraryDb;
  let auth: AuthService;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, sessions, documents, passages, extracted_values CASCADE`);
    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada' }]);
    auth = new AuthService(db, new SeededEmailProvider(db));
  });

  it('signing in with a seeded email returns the user and a session token', async () => {
    const result = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    expect(result?.user.email).toBe('ada@firm.test');
    expect(result?.session.token.length).toBeGreaterThan(20);
  });

  it('an unknown email gets the same null as a refused kind — nothing enumerates the roster', async () => {
    const unknown = await auth.signIn({ kind: 'email', email: 'stranger@elsewhere.test' });
    expect(unknown).toBeNull();
    const refused = await auth.signIn({ kind: 'google', subject: 'sub-1' });
    expect(refused).toBeNull();
  });

  it('the session token resolves to the viewer', async () => {
    const result = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    if (result === null) {
      throw new Error('expected sign-in to succeed');
    }
    const viewer = await auth.viewerFromToken(result.session.token);
    expect(viewer?.userId).toBe(result.user.userId);
  });

  it('a missing token resolves to no viewer', async () => {
    const viewer = await auth.viewerFromToken(undefined);
    expect(viewer).toBeNull();
  });

  it('sign-out ends the session; the token resolves to no viewer afterwards', async () => {
    const result = await auth.signIn({ kind: 'email', email: 'ada@firm.test' });
    if (result === null) {
      throw new Error('expected sign-in to succeed');
    }
    await auth.signOut(result.session.token);
    expect(await auth.viewerFromToken(result.session.token)).toBeNull();
    // Idempotent: signing out again is fine.
    await expect(auth.signOut(result.session.token)).resolves.toBeUndefined();
  });

  it('any IdentityProvider implementation drives the same service — the seam is swappable', async () => {
    const withRoster = new AuthService(db, new RosterProvider(db));
    const result = await withRoster.signIn({ kind: 'email', email: '  ADA@firm.test ' });
    expect(result?.user.displayName).toBe('Ada');
    if (result === null) {
      throw new Error('expected roster sign-in to succeed');
    }
    expect(await withRoster.viewerFromToken(result.session.token)).not.toBeNull();
  });
});
