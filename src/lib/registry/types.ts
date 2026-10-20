import type { methodEdges, methodKindEnum, methods } from '@/db/schema';

/**
 * What the method is: a measurement procedure (produces quantities) or a
 * classification system (assigns named classes). Closed set, like every enum
 * in the schema — the types and the database cannot drift.
 */
export type MethodKind = (typeof methodKindEnum.enumValues)[number];

export type MethodRow = typeof methods.$inferSelect;
export type MethodEdgeRow = typeof methodEdges.$inferSelect;

/** A method the registry accounts for. Ids are lowercase slugs — the canonical spelling values cite. */
export interface NewMethod {
  id: string;
  /** Display name, e.g. 'EN 13501-1:2018 — fire classification of construction products'. */
  name: string;
  kind: MethodKind;
  /**
   * The property dimension the method addresses, e.g. 'fire-performance'.
   * Recorded on the account, but descriptive only — matching quantities never
   * confer comparability; only an explicit edge does.
   */
  quantity: string;
  /** Edition year when the row is edition-specific, e.g. '2018'. */
  edition?: string;
}

/**
 * A comparability edge between two distinct methods. Comparability is
 * symmetric: the registry stores one row per unordered pair in canonical
 * (lexicographic) direction, so callers may hand the ends in either order.
 */
export interface NewMethodEdge {
  fromMethodId: string;
  toMethodId: string;
  comparable: boolean;
  /** Why the edge holds — shown with the verdict, never inferred. */
  note: string;
}
