import type { LibraryDb } from '@/db/client';
import type { Viewer } from '@/lib/library/types';
import type { IdentityProvider, ProviderUser, SignInInput } from './provider';
import { SessionService } from './session';

/** The signed-in principal, as the rest of the app may know it. */
export type AuthedUser = ProviderUser;

export interface SignInResult {
  user: AuthedUser;
  session: { token: string; expiresAt: Date };
}

/**
 * Sign-in and viewer resolution. The provider decides who may sign in; this
 * service mints and resolves their sessions. Every request's identity flows
 * through `viewerFromToken`: a null viewer means unauthenticated, and the
 * caller — the library service, the scoped search tool — treats null as
 * "return nothing, run nothing".
 */
export class AuthService {
  private readonly sessions: SessionService;

  constructor(
    db: LibraryDb,
    private readonly provider: IdentityProvider,
    private readonly clock: () => Date = () => new Date()
  ) {
    this.sessions = new SessionService(db, clock);
  }

  /**
   * Sign in with the provider's credentials. Unknown credentials and refused
   * kinds both return null — the response does not distinguish them, so the
   * roster cannot be enumerated from the outside.
   */
  async signIn(input: SignInInput): Promise<SignInResult | null> {
    const user = await this.provider.authenticate(input);
    if (user === null) {
      return null;
    }
    const { token, session } = await this.sessions.create(user.userId);
    return { user, session: { token, expiresAt: session.expiresAt } };
  }

  /**
   * The viewer behind a presented session token, or null when there is none:
   * no token, an unknown token, or an expired one. This is the handoff every
   * authenticated request walks before anything reaches the model.
   */
  async viewerFromToken(token: string | undefined): Promise<Viewer | null> {
    const session = await this.sessions.resolve(token);
    if (session === null) {
      return null;
    }
    return { userId: session.userId };
  }

  /** Sign out. Idempotent — an unknown token has nothing to end. */
  async signOut(token: string | undefined): Promise<void> {
    await this.sessions.revoke(token);
  }
}
