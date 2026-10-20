import { fileURLToPath } from 'node:url';
import { migrate as drizzleMigrate } from 'drizzle-orm/pglite/migrator';
import type { LibraryDb } from './client';

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

/** Apply pending migrations. Idempotent — applied ones are tracked in the db. */
export async function runMigrations(db: LibraryDb): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder });
}
