import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { sessions, users } from '@/db/schema';
import { seedFirmUsers } from './seed';
import { SESSION_TTL_MS, SessionService, generateSessionToken, hashSessionToken } from './session';

/**
 * Walk a rejected promise's cause chain to the underlying engine error.
 * Drizzle wraps engine errors in a DrizzleQueryError whose `cause` carries the
 * violated constraint's name — the meaningful message lives at the bottom.
 */
async function engineRejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (e) {
    let current: unknown = e;
    for (let depth = 0; depth < 6 && current instanceof Error; depth += 1) {
      if (/sessions_user_id_users_id_fk/.test(current.message)) {
        return current;
      }
      current = current.cause;
    }
    if (e instanceof Error) {
      return e;
    }
    return new Error(String(e));
  }
  throw new Error('expected the promise to reject');
}

describe('session security and expiry', () => {
  let db: LibraryDb;
  let service: SessionService;
  /** Mutable clock — expiry tests advance it instead of sleeping. */
  let now: Date;
  let adaId: string;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, sessions, documents, passages, extracted_values CASCADE`);
    now = new Date('2026-10-20T12:00:00.000Z');
    service = new SessionService(db, () => now);
    await seedFirmUsers(db, [{ email: 'ada@firm.test', displayName: 'Ada' }]);
    const rows = await db.select().from(users);
    const ada = rows[0];
    if (ada === undefined) {
      throw new Error('expected the seeded user to exist');
    }
    adaId = ada.id;
  });

  it('tokens are unique and are not their own hash', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
    expect(hashSessionToken('a-token')).not.toBe('a-token');
    expect(hashSessionToken('a-token')).toHaveLength(64); // sha-256 hex
  });

  it('a created session resolves by its token — and only the hash is stored', async () => {
    const { token, session } = await service.create(adaId);

    expect(session.tokenHash).toBe(hashSessionToken(token));
    expect(session.tokenHash).not.toContain(token);
    const stored = await db.select().from(sessions).where(eq(sessions.id, session.id)).limit(1);
    expect(JSON.stringify(stored)).not.toContain(token);

    const resolved = await service.resolve(token);
    expect(resolved?.id).toBe(session.id);
  });

  it('an unknown token resolves to nothing', async () => {
    await service.create(adaId);
    const resolved = await service.resolve(randomUUID());
    expect(resolved).toBeNull();
  });

  it('a missing token resolves to nothing', async () => {
    const resolved = await service.resolve(undefined);
    expect(resolved).toBeNull();
  });

  it('an expired session resolves to nothing and is deleted', async () => {
    const { token, session } = await service.create(adaId);
    now = new Date(now.getTime() + SESSION_TTL_MS + 1);

    const resolved = await service.resolve(token);
    expect(resolved).toBeNull();

    const remaining = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(remaining).toHaveLength(0);
  });

  it('a session at exactly its expiry boundary is still valid — expiry has passed then', async () => {
    // The TTL counts from creation: valid until expiry, dead the instant after.
    const { token } = await service.create(adaId);
    now = new Date(now.getTime() + SESSION_TTL_MS);
    expect(await service.resolve(token)).not.toBeNull();
    now = new Date(now.getTime() + 1);
    expect(await service.resolve(token)).toBeNull();
  });

  it('revocation ends the session and is idempotent', async () => {
    const { token } = await service.create(adaId);
    await service.revoke(token);
    expect(await service.resolve(token)).toBeNull();
    await expect(service.revoke(token)).resolves.toBeUndefined();
    await expect(service.revoke(undefined)).resolves.toBeUndefined();
  });

  it('a session cannot name a user who does not exist', async () => {
    const rejection = await engineRejection(service.create('00000000-0000-0000-0000-000000000000'));
    expect(rejection.message).toMatch(/sessions_user_id_users_id_fk/);
  });
});
