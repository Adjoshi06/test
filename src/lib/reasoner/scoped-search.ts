// The identity gate in front of the model's one tool. An unauthenticated
// request returns nothing and the delegate search never runs — identity is
// resolved before anything reaches the model (spec art_Ene8eA8R, "Private
// stays private"). With a viewer present the delegate runs; per-viewer
// scoping inside the delegate is the library's query-layer contract: every
// library query filters by the caller's owner id.

import type { Viewer } from '@/lib/library/types';
import type { LibrarySearchQuery, LibrarySearchResult, LibrarySearchTool } from './search';

export class ViewerScopedSearch implements LibrarySearchTool {
  constructor(
    private readonly delegate: LibrarySearchTool,
    private readonly viewer: Viewer | null
  ) {}

  async search(query: LibrarySearchQuery): Promise<LibrarySearchResult> {
    if (this.viewer === null) {
      return { records: [] };
    }
    return this.delegate.search(query);
  }
}
