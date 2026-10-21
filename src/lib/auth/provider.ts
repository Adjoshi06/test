/**
 * The identity contract. The sign-in mechanism is swappable: this release
 * authenticates against the seeded firm roster by email; Google OAuth lands
 * behind this same interface in the connectors phase (locked decision in the
 * spec). The provider resolves credentials to an existing firm user — it
 * never creates one. The roster is the source of truth for who may sign in.
 */

import type { Viewer } from '@/lib/library/types';

/**
 * What a caller presents to sign in. A discriminated union so Google OAuth
 * can join without reshaping the interface or the service.
 */
export type SignInInput = { kind: 'email'; email: string } | { kind: 'google'; subject: string };

/** The provider's resolution: an existing firm user, or nothing. */
export interface ProviderUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface IdentityProvider {
  /**
   * Resolve sign-in input to a firm user. Returns null when the credentials
   * do not match — the same shape for "no such user" and "wrong method", so
   * nothing about the roster leaks through the response.
   */
  authenticate(input: SignInInput): Promise<ProviderUser | null>;
}

/** Anything an authenticated principal can be handed to as. */
export type { Viewer };
