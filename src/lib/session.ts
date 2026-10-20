// Session resolution — the seam sign-in lands behind (spec open question 2).
// Until sign-in ships, pages resolve the seeded dev viewer so every request
// still flows through the library's visibility-scoped queries — the same path
// a real session takes. Sign-in replaces only this module; the pages and the
// service do not change.

import { LibraryService } from '@/lib/library/service';
import type { Viewer } from '@/lib/library/types';
import { ensureDevSeed, getAppDb } from '@/lib/seed';

/** The current viewer. Sign-in lands here; the dev seed fills it until then. */
export async function getViewer(): Promise<Viewer | null> {
  const seed = await ensureDevSeed();
  return { userId: seed.userId };
}

/** The viewer-scoped library service — the only read path pages use. */
export async function getSessionLibrary(): Promise<LibraryService> {
  const viewer = await getViewer();
  return new LibraryService(getAppDb(), viewer);
}
