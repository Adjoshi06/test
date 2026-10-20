import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { users } from '@/db/schema';
import { normalizeEmail, seedFirmUsers } from './seed';

describe('seedFirmUsers', () => {
  let db: LibraryDb;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, sessions, documents, passages, extracted_values CASCADE`);
  });

  it('seeds the roster with display names', async () => {
    await seedFirmUsers(db, [
      { email: 'ada@firm.test', displayName: 'Ada' },
      { email: 'brno@firm.test', displayName: 'Brno' },
    ]);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.displayName).sort()).toEqual(['Ada', 'Brno']);
  });

  it('normalizes emails — case and whitespace do not create duplicate identities', async () => {
    await seedFirmUsers(db, [{ email: '  ADA@FIRM.TEST ' }]);
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('ada@firm.test');
  });

  it('is idempotent — re-seeding refreshes names without duplicating rows or changing ids', async () => {
    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada' }]);
    const first = await db.select().from(users);
    const firstId = first[0]?.id;
    expect(firstId).toBeDefined();

    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada (refreshed)' }]);
    const second = await db.select().from(users);
    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(firstId);
    expect(second[0]?.displayName).toBe('Ada (refreshed)');
  });

  it('defaults the display name when none is given', async () => {
    await seedFirmUsers(db, [{ email: 'chae@firm.test' }]);
    const rows = await db.select().from(users);
    expect(rows[0]?.displayName).toBe('Firm user 1');
  });

  it('accepts an empty roster as a no-op', async () => {
    await expect(seedFirmUsers(db, [])).resolves.toBeUndefined();
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('normalizeEmail is the single normalization the roster and provider share', () => {
    expect(normalizeEmail('  ADA@Firm.TEST ')).toBe('ada@firm.test');
  });
});
