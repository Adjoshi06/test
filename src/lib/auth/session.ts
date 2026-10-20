import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { sessions } from '@/db/schema';

/**
 * Sessions live 30 days — a single office's working sessions, long enough not
 * to nag, short enough that abandonment closes itself.
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The opaque session token. 256 bits of crypto randomness: nothing about the
 * user can be derived from it, and it cannot be guessed.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only the token's SHA-256 hash is stored. A leaked database yields hashes,
 * not sessions — the token exists only in the client.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type SessionRow = typeof sessions.$inferSelect;

/**
 * Session creation, resolution, and revocation. The clock is injectable so
 * expiry is tested by advancing it, not by sleeping.
 */
export class SessionService {
  constructor(
    private readonly db: LibraryDb,
    private readonly clock: () => Date = () => new Date()
  ) {}

  /** Mint a session for an existing user. The token is returned once — only its hash persists. */
  async create(userId: string): Promise<{ token: string; session: SessionRow }> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(this.clock().getTime() + SESSION_TTL_MS);
    const rows = await this.db
      .insert(sessions)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    const session = rows[0];
    if (session === undefined) {
      throw new Error('session insert returned no row');
    }
    return { token, session };
  }

  /**
   * Resolve a presented token to its session row, or null. Expired sessions
   * are deleted on the way — expiry is enforced here, not trusted to anyone
   * else to clean up. A missing and an expired token resolve to the same
   * null: neither may act, and neither may be told apart from the outside.
   */
  async resolve(token: string | undefined): Promise<SessionRow | null> {
    if (token === undefined || token.length === 0) {
      return null;
    }
    const now = this.clock();
    await this.db.delete(sessions).where(lt(sessions.expiresAt, now));
    const rows = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)))
      .limit(1);
    const session = rows[0];
    if (session === undefined) {
      return null;
    }
    if (session.expiresAt.getTime() < now.getTime()) {
      return null;
    }
    return session;
  }

  /** End a session. Idempotent — revoking an unknown or dead token is fine. */
  async revoke(token: string | undefined): Promise<void> {
    if (token === undefined || token.length === 0) {
      return;
    }
    await this.db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
}
