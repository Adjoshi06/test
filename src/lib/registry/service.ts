import { and, asc, eq, inArray } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { methodEdges, methods } from '@/db/schema';
import { decideComparability, orderedMethods } from './comparability';
import type { ComparabilityDecision } from './comparability';
import { RegistryIntegrityError, RegistryNotFoundError } from './errors';
import { REGISTRY_SEED } from './seed-data';
import type { MethodEdgeRow, MethodRow, NewMethod, NewMethodEdge } from './types';

/**
 * Postgres error surface we map on — the same shape the library service
 * handles: Drizzle wraps engine errors in a DrizzleQueryError whose `cause`
 * carries the SQLSTATE code and the violated constraint's name.
 */
interface DbConstraintError {
  code: string;
  constraint?: string;
}

/** Walk the cause chain (bounded) to find the underlying engine error. */
function findConstraintError(e: unknown): DbConstraintError | null {
  let current: unknown = e;
  for (let depth = 0; depth < 6 && current !== null && current !== undefined; depth += 1) {
    if (
      typeof current === 'object' &&
      'code' in current &&
      typeof current.code === 'string' &&
      current.code.startsWith('23') // integrity-violation SQLSTATE class
    ) {
      const constraint =
        'constraint' in current && typeof current.constraint === 'string'
          ? current.constraint
          : undefined;
      return { code: current.code, constraint };
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
}

/** The root error of a cause chain — what a RegistryIntegrityError carries. */
function rootCause(e: unknown): unknown {
  let current: unknown = e;
  while (current instanceof Error && current.cause !== undefined && current.cause !== null) {
    current = current.cause;
  }
  return current;
}

/**
 * Map an engine constraint violation to a typed integrity error that says
 * which invariant failed in domain terms. Unknown failures surface untouched
 * — never swallowed.
 */
function toIntegrityError(e: unknown): RegistryIntegrityError | null {
  const db = findConstraintError(e);
  if (db === null) {
    return null;
  }
  const cause = rootCause(e);
  switch (db.constraint) {
    case 'methods_id_lowercase':
      return new RegistryIntegrityError('method ids are lowercase slugs', { cause });
    case 'methods_name_nonempty':
      return new RegistryIntegrityError('method name must not be empty', { cause });
    case 'methods_quantity_nonempty':
      return new RegistryIntegrityError('method quantity must not be empty', { cause });
    case 'methods_pkey':
      return new RegistryIntegrityError('this method id is already registered', { cause });
    case 'method_edges_from_method_id_to_method_id_pk':
      return new RegistryIntegrityError('this method pair already has a comparability edge', {
        cause,
      });
    case 'method_edges_canonical_direction':
      return new RegistryIntegrityError(
        'a comparability edge is stored once per pair in canonical order (from < to) — a method never needs an edge to itself',
        { cause }
      );
    case 'method_edges_note_nonempty':
      return new RegistryIntegrityError(
        'a comparability edge must record why it holds — the note is shown with the verdict',
        { cause }
      );
    case 'method_edges_from_method_id_methods_id_fk':
    case 'method_edges_to_method_id_methods_id_fk':
      return new RegistryIntegrityError(
        'both ends of a comparability edge must be registered methods',
        {
          cause,
        }
      );
    default:
      // Unnamed unique and check violations surface with a generic message;
      // anything else is not ours to interpret.
      if (db.code === '23505') {
        return new RegistryIntegrityError('this registry record already exists', {
          constraint: db.constraint,
          cause,
        });
      }
      if (db.code === '23514') {
        return new RegistryIntegrityError('a registry invariant was violated', {
          constraint: db.constraint,
          cause,
        });
      }
      return null;
  }
}

/**
 * The methods registry: the account of which measurement methods and
 * classification systems exist, and which may be set side by side.
 *
 * Unlike the LibraryService, no viewer is taken: methods and their
 * comparability edges are the firm-wide vocabulary every user's values
 * address — the one shared truth the assertion checker compares against, not
 * per-user material.
 */
export class RegistryService {
  constructor(private readonly db: LibraryDb) {}

  /** Insert and hand back the single returned row, mapping engine violations. */
  private async insertOne<T>(what: string, insert: () => Promise<T[]>): Promise<T> {
    let rows: T[];
    try {
      rows = await insert();
    } catch (e) {
      const mapped = toIntegrityError(e);
      if (mapped !== null) {
        throw mapped;
      }
      throw e;
    }
    const row = rows[0];
    if (row === undefined) {
      throw new RegistryIntegrityError(`${what} insert returned no row`);
    }
    return row;
  }

  /** Register a method under its canonical lowercase id. */
  async defineMethod(input: NewMethod): Promise<MethodRow> {
    const id = input.id.trim();
    const name = input.name.trim();
    const quantity = input.quantity.trim();
    if (!id) {
      throw new RegistryIntegrityError('method id must not be empty');
    }
    if (id !== id.toLowerCase()) {
      throw new RegistryIntegrityError(
        'method ids are lowercase slugs — the canonical spelling values cite'
      );
    }
    if (!name) {
      throw new RegistryIntegrityError('method name must not be empty');
    }
    if (!quantity) {
      throw new RegistryIntegrityError('method quantity must not be empty');
    }
    return this.insertOne('method', () =>
      this.db
        .insert(methods)
        .values({ id, name, kind: input.kind, quantity, edition: input.edition?.trim() || null })
        .returning()
    );
  }

  /**
   * Record a comparability edge. The ends may arrive in either order — the
   * pair is stored once, in canonical direction, because comparability is
   * symmetric. The note is required: an edge without its why is an
   * unaccountable grant.
   */
  async defineEdge(input: NewMethodEdge): Promise<MethodEdgeRow> {
    if (!input.note.trim()) {
      throw new RegistryIntegrityError(
        'a comparability edge must record why it holds — the note is shown with the verdict'
      );
    }
    const from = input.fromMethodId.trim();
    const to = input.toMethodId.trim();
    if (!from || !to) {
      throw new RegistryIntegrityError('a comparability edge needs two method ids');
    }
    const [canonicalFrom, canonicalTo] = orderedMethods(from, to);
    if (canonicalFrom === canonicalTo) {
      throw new RegistryIntegrityError(
        'a method needs no edge to itself — same-method comparison is trivially comparable'
      );
    }
    // Name a missing end here; the engine's foreign keys hold the same line.
    const ends = await this.db
      .select({ id: methods.id })
      .from(methods)
      .where(inArray(methods.id, [canonicalFrom, canonicalTo]));
    const known = new Set(ends.map((row) => row.id));
    const missing = [canonicalFrom, canonicalTo].find((id) => !known.has(id));
    if (missing !== undefined) {
      throw new RegistryNotFoundError(missing);
    }
    return this.insertOne('edge', () =>
      this.db
        .insert(methodEdges)
        .values({
          fromMethodId: canonicalFrom,
          toMethodId: canonicalTo,
          comparable: input.comparable,
          note: input.note.trim(),
        })
        .returning()
    );
  }

  async getMethod(id: string): Promise<MethodRow | null> {
    const rows = await this.db.select().from(methods).where(eq(methods.id, id.trim())).limit(1);
    return rows[0] ?? null;
  }

  /** Every registered method, canonical id order. */
  async listMethods(): Promise<MethodRow[]> {
    return this.db.select().from(methods).orderBy(asc(methods.id));
  }

  /** Every recorded edge, canonical direction, pair order. */
  async listEdges(): Promise<MethodEdgeRow[]> {
    return this.db
      .select()
      .from(methodEdges)
      .orderBy(asc(methodEdges.fromMethodId), asc(methodEdges.toMethodId));
  }

  /**
   * The comparison the assertion checker calls. Registered pairs always
   * answer — comparable, or not-comparable with the reason the account
   * records. Unregistered ids throw: comparing against a method the account
   * does not know is an integrity gap to surface, never an outcome.
   */
  async compareMethods(aId: string, bId: string): Promise<ComparabilityDecision> {
    const a = aId.trim();
    const b = bId.trim();
    if (!a || !b) {
      throw new RegistryIntegrityError('comparing methods requires two method ids');
    }
    const known = await this.db
      .select({ id: methods.id })
      .from(methods)
      .where(inArray(methods.id, [a, b]));
    const knownIds = new Set(known.map((row) => row.id));
    for (const id of [a, b]) {
      if (!knownIds.has(id)) {
        throw new RegistryNotFoundError(id);
      }
    }
    const [from, to] = orderedMethods(a, b);
    const edgeRows =
      from === to
        ? [] // same method — the pure rule answers without an edge lookup
        : await this.db
            .select()
            .from(methodEdges)
            .where(and(eq(methodEdges.fromMethodId, from), eq(methodEdges.toMethodId, to)))
            .limit(1);
    const edge = edgeRows[0];
    return decideComparability(
      a,
      b,
      edge === undefined ? null : { comparable: edge.comparable, note: edge.note }
    );
  }

  /**
   * Load the seeded account. Idempotent — re-running leaves the registry
   * unchanged, so tests and later fixture loaders can call it freely.
   */
  async seed(): Promise<void> {
    await this.db.insert(methods).values(REGISTRY_SEED.methods).onConflictDoNothing();
    await this.db.insert(methodEdges).values(REGISTRY_SEED.edges).onConflictDoNothing();
  }
}
