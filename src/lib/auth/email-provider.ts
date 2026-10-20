import { eq } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { users } from '@/db/schema';
import type { IdentityProvider, ProviderUser, SignInInput } from './provider';

/**
 * Email sign-in against the seeded firm roster (this release's provider).
 * Emails are compared case-insensitively — the roster stores them normalized.
 * Other sign-in kinds are refused here until their providers land.
 */
export class SeededEmailProvider implements IdentityProvider {
  constructor(private readonly db: LibraryDb) {}

  async authenticate(input: SignInInput): Promise<ProviderUser | null> {
    if (input.kind !== 'email') {
      // Google OAuth joins behind the same interface in the connectors phase.
      return null;
    }
    const normalized = input.email.trim().toLowerCase();
    if (normalized.length === 0) {
      return null;
    }
    const rows = await this.db.select().from(users).where(eq(users.email, normalized)).limit(1);
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { userId: row.id, email: row.email, displayName: row.displayName };
  }
}
