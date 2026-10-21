// Session resolution — the seam sign-in landed behind (spec open question 2).
// The viewer resolves from the request's opaque session cookie: the session's
// user when valid, or null when unauthenticated, unknown, expired, or signed
// out. A null viewer's library service returns nothing — the library's
// query-layer contract — so anonymous requests render an empty library and can
// write nothing. Sign-in replaced only this module; the pages and the service
// did not change.
//
// The dev seed still owns process boot — migrations and the synthetic corpus
// (locked decision: fixtures are synthetic and clearly marked). It no longer
// decides identity: the corpus belongs to the dev-seed firm user, and only a
// signed-in session for a seeded firm user sees their own material. Sign-in
// routes (a separate deliverable) set SESSION_COOKIE_NAME on success.

import { cookies } from 'next/headers';
import { SeededEmailProvider } from '@/lib/auth/email-provider';
import { AuthService } from '@/lib/auth/service';
import { LibraryService } from '@/lib/library/service';
import type { Viewer } from '@/lib/library/types';
import { ensureDevSeed, getAppDb } from '@/lib/seed';

/** The request cookie carrying the opaque session token; sign-in sets it. */
export const SESSION_COOKIE_NAME = 'firm_session';

// One auth service per process, over the app's database handle.
const authService = new AuthService(getAppDb(), new SeededEmailProvider(getAppDb()));

/** The current viewer: the session cookie's user, or null when unauthenticated. */
export async function getViewer(): Promise<Viewer | null> {
  // Process boot — migrations must precede the sessions-table query. Once per
  // process; concurrent first requests await the same promise.
  await ensureDevSeed();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return authService.viewerFromToken(token);
}

/** The viewer-scoped library service — the only read path pages use. */
export async function getSessionLibrary(): Promise<LibraryService> {
  const viewer = await getViewer();
  return new LibraryService(getAppDb(), viewer);
}
