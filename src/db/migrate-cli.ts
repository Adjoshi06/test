// Apply the committed migrations to a persistent local PGlite database.
// The compose Postgres serves the running app from the answering-loop PR
// onward; this CLI exists so migrations can be applied outside tests.
import { mkdirSync } from 'node:fs';
import { createDb } from './client';
import { runMigrations } from './migrate';

async function main(): Promise<void> {
  const dataDir = process.env.PGLITE_DATA_DIR;
  if (!dataDir) {
    console.error('Set PGLITE_DATA_DIR to a directory to migrate a persistent local database.');
    process.exit(2);
  }

  mkdirSync(dataDir, { recursive: true }); // PGlite does not create parents
  const db = createDb(dataDir);
  try {
    await runMigrations(db);
    console.log(`Migrations applied to ${dataDir}`);
  } finally {
    await db.$client.close();
  }
}

void main();
