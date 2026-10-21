import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { users } from '@/db/schema';
import { SeededEmailProvider } from './email-provider';
import { seedFirmUsers } from './seed';

describe('SeededEmailProvider', () => {
  let db: LibraryDb;
  let provider: SeededEmailProvider;
  let adaId: string;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, sessions, documents, passages, extracted_values CASCADE`);
    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada' }]);
    const rows = await db.select().from(users);
    const ada = rows[0];
    if (ada === undefined) {
      throw new Error('expected the seeded user to exist');
    }
    adaId = ada.id;
    provider = new SeededEmailProvider(db);
  });

  it('matches a seeded email case-insensitively', async () => {
    const resolved = await provider.authenticate({ kind: 'email', email: 'ADA@FIRM.TEST' });
    expect(resolved?.userId).toBe(adaId);
    expect(resolved?.displayName).toBe('Ada');
  });

  it('tolerates surrounding whitespace', async () => {
    const resolved = await provider.authenticate({ kind: 'email', email: '  ada@firm.test  ' });
    expect(resolved?.userId).toBe(adaId);
  });

  it('returns null for an unseeded email — the roster decides who may sign in', async () => {
    const resolved = await provider.authenticate({
      kind: 'email',
      email: 'stranger@elsewhere.test',
    });
    expect(resolved).toBeNull();
  });

  it('returns null for a blank email', async () => {
    const resolved = await provider.authenticate({ kind: 'email', email: '   ' });
    expect(resolved).toBeNull();
  });

  it('refuses non-email kinds — other providers own those', async () => {
    const resolved = await provider.authenticate({ kind: 'google', subject: randomUUID() });
    expect(resolved).toBeNull();
  });
});
