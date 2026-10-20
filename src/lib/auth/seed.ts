import { sql } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { users } from '@/db/schema';

/** One seeded firm user. The roster is the source of truth for who may sign in. */
export interface FirmUserSeed {
  email: string;
  displayName?: string;
}

/**
 * Emails are normalized before storage and before every lookup, so sign-in is
 * case-insensitive and whitespace-tolerant without weakening uniqueness.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Idempotently seed the firm roster. Re-running with the same emails leaves
 * one row per email — the display name is refreshed, the user id (and every
 * library row that points at it) survives unchanged.
 */
export async function seedFirmUsers(db: LibraryDb, seeds: readonly FirmUserSeed[]): Promise<void> {
  if (seeds.length === 0) {
    return;
  }
  await db
    .insert(users)
    .values(
      seeds.map((seed, index) => ({
        email: normalizeEmail(seed.email),
        displayName: seed.displayName ?? `Firm user ${index + 1}`,
      }))
    )
    // The conflicting row's own display name: re-seeding refreshes it in place.
    .onConflictDoUpdate({
      target: users.email,
      set: { displayName: sql`excluded.display_name` },
    });
}
