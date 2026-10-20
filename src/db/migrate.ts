import { join } from 'node:path';
import { migrate as drizzleMigrate } from 'drizzle-orm/pglite/migrator';
import type { LibraryDb } from './client';

// Runtime folder path, resolved from the process working directory (repo root
// for dev, start, tests, and the migrate CLI). It must NOT be a static
// `new URL('./migrations', import.meta.url)`: webpack compiles that into a
// module lookup and the Next.js build fails on the folder reference.
const migrationsFolder = join(process.cwd(), 'src', 'db', 'migrations');

/** Apply pending migrations. Idempotent — applied ones are tracked in the db. */
export async function runMigrations(db: LibraryDb): Promise<void> {
  await drizzleMigrate(db, { migrationsFolder });
}
