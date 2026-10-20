import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from './schema';

/**
 * The database handle the library service is typed against. Tests and the dev
 * CLI run on PGlite (in-process Postgres — same engine semantics: enums,
 * checks, composite foreign keys). The answering-loop PR adds the server
 * driver against the compose Postgres; the service stays driver-agnostic.
 */
export type LibraryDb = PgliteDatabase<typeof schema> & { $client: PGlite };

/** Create an in-process Postgres backed by `dataDir` (in-memory when omitted). */
export function createDb(dataDir?: string): LibraryDb {
  return drizzle(new PGlite(dataDir), { schema });
}
