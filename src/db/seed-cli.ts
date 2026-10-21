import { createDb } from './client';
import { runMigrations } from './migrate';
import { normalizeEmail, seedFirmUsers, type FirmUserSeed } from '@/lib/auth/seed';

/**
 * Seed the firm roster into a PGlite database (in-memory by default; point
 * PGLITE_DATA_DIR at a directory to persist). Emails come from
 * FIRM_USER_EMAILS (comma-separated); the default roster is clearly synthetic
 * — .test addresses, never real people.
 */
const SYNTHETIC_DEFAULT_ROSTER: readonly FirmUserSeed[] = [
  { email: 'ada@firm.test', displayName: 'Ada (synthetic)' },
  { email: 'brno@firm.test', displayName: 'Brno (synthetic)' },
  { email: 'chae@firm.test', displayName: 'Chae (synthetic)' },
];

async function main(): Promise<void> {
  const db = createDb(process.env.PGLITE_DATA_DIR);
  await runMigrations(db);

  const fromEnv = process.env.FIRM_USER_EMAILS;
  const seeds: readonly FirmUserSeed[] =
    fromEnv === undefined || fromEnv.trim().length === 0
      ? SYNTHETIC_DEFAULT_ROSTER
      : fromEnv
          .split(',')
          .map((email) => email.trim())
          .filter((email) => email.length > 0)
          .map((email) => ({ email }));

  if (seeds.length === 0) {
    throw new Error('FIRM_USER_EMAILS is set but produced no addresses');
  }
  await seedFirmUsers(db, seeds);
  console.log(
    `Seeded ${seeds.length} firm user(s): ${seeds
      .map((seed) => normalizeEmail(seed.email))
      .join(', ')}`
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
