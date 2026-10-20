import { and, eq, inArray } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { documents, extractedValues, passages } from '@/db/schema';
import { LibraryAccessError, LibraryIntegrityError, LibraryNotFoundError } from './errors';
import type {
  DocumentRow,
  NewDocument,
  NewPassage,
  NewValue,
  PassageRow,
  ValueRow,
  Viewer,
} from './types';

/**
 * Postgres error surface we map on. PGlite errors carry the SQLSTATE code and
 * the violated constraint's name.
 */
interface DbConstraintError {
  code?: string;
  constraint?: string;
}

function isConstraintError(e: unknown): e is DbConstraintError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof e.code === 'string' &&
    'constraint' in e &&
    typeof e.constraint === 'string'
  );
}

/**
 * Map an engine constraint violation to a typed integrity error that says
 * which invariant failed in domain terms. Returns null for anything not
 * recognized so unknown failures surface untouched — never swallowed.
 */
function toIntegrityError(e: unknown): LibraryIntegrityError | null {
  if (!isConstraintError(e) || (e.code !== '23505' && e.code !== '23514' && e.code !== '23503')) {
    return null;
  }
  const cause = e;
  switch (e.constraint) {
    case 'documents_title_nonempty':
      return new LibraryIntegrityError('document title must not be empty', { cause });
    case 'documents_owner_id_users_id_fk':
      return new LibraryIntegrityError('the document owner must be an existing user', { cause });
    case 'passages_document_owner_fkey':
      return new LibraryIntegrityError(
        'a passage must live inside a document that exists and belongs to the same owner',
        { cause }
      );
    case 'passages_document_locator_key':
      return new LibraryIntegrityError(
        'this document already has a passage at this locator — a place holds one verbatim quote',
        { cause }
      );
    case 'passages_locator_nonempty':
      return new LibraryIntegrityError('passage locator must not be empty', { cause });
    case 'passages_quote_nonempty':
      return new LibraryIntegrityError(
        'passage quote must not be empty — a value cannot exist without its verbatim evidence',
        { cause }
      );
    case 'extracted_values_passage_owner_fkey':
      return new LibraryIntegrityError(
        'a value must sit on a passage that exists and belongs to the same owner',
        { cause }
      );
    case 'extracted_values_verified_by_fkey':
      return new LibraryIntegrityError('the verifier must be an existing user', { cause });
    case 'extracted_values_verifier_matches_state':
      return new LibraryIntegrityError(
        'a human-verified value requires a verifier id, and no other verification state may carry one',
        { cause }
      );
    default:
      // A non-empty check on a column we did not name individually.
      return e.code === '23514'
        ? new LibraryIntegrityError('a required library field must not be empty', {
            constraint: e.constraint,
            cause,
          })
        : null;
  }
}

/**
 * The library service. Every method is scoped to the viewer: children can only
 * attach to parents the viewer owns, and every query filters by the owner.
 * The owner is always derived from the viewer — never accepted from callers.
 */
export class LibraryService {
  constructor(
    private readonly db: LibraryDb,
    private readonly viewer: Viewer | null
  ) {}

  private requireViewer(): Viewer {
    if (this.viewer === null) {
      throw new LibraryAccessError();
    }
    return this.viewer;
  }

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
      throw new LibraryIntegrityError(`${what} insert returned no row`);
    }
    return row;
  }

  async createDocument(input: NewDocument): Promise<DocumentRow> {
    const viewer = this.requireViewer();
    return this.insertOne('document', () =>
      this.db
        .insert(documents)
        .values({
          ownerId: viewer.userId,
          title: input.title.trim(),
          kind: input.kind,
          jurisdiction: input.jurisdiction?.trim() || null,
          edition: input.edition?.trim() || null,
        })
        .returning()
    );
  }

  /**
   * A passage is a place in a document: an exact locator plus the verbatim
   * quote sitting there. The quote is stored untouched — verbatim means
   * verbatim.
   */
  async addPassage(input: NewPassage): Promise<PassageRow> {
    const viewer = this.requireViewer();
    if (!input.locator.trim()) {
      throw new LibraryIntegrityError('passage locator must not be empty');
    }
    if (!input.quote.trim()) {
      throw new LibraryIntegrityError(
        'passage quote must not be empty — a value cannot exist without its verbatim evidence'
      );
    }
    // The document must exist and be visible to this viewer; anything else is
    // "not found" — invisibility must not leak existence.
    const document = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, input.documentId), eq(documents.ownerId, viewer.userId)))
      .limit(1);
    if (document[0] === undefined) {
      throw new LibraryNotFoundError('Document');
    }
    return this.insertOne('passage', () =>
      this.db
        .insert(passages)
        .values({
          documentId: input.documentId,
          ownerId: viewer.userId,
          locator: input.locator.trim(),
          quote: input.quote,
        })
        .returning()
    );
  }

  /**
   * Record a value under its evidence. The passage — document, locator,
   * verbatim quote — must already exist and belong to the viewer: the
   * persistence layer rejects any value that cannot resolve to a place in a
   * source document.
   */
  async recordValue(input: NewValue): Promise<ValueRow> {
    const viewer = this.requireViewer();
    if (!input.propertyId.trim()) {
      throw new LibraryIntegrityError('property id must not be empty');
    }
    if (!input.raw.trim()) {
      throw new LibraryIntegrityError('raw value must not be empty');
    }
    if (!input.methodId.trim()) {
      throw new LibraryIntegrityError('method id must not be empty');
    }
    // Runtime mirror of the VerificationClaim union — types erase at runtime,
    // and a cast caller must still be rejected here and by the engine check.
    const wantsVerifier = input.verification === 'human-verified';
    const hasVerifier = input.verifiedBy !== undefined && input.verifiedBy !== null;
    if (wantsVerifier !== hasVerifier) {
      throw new LibraryIntegrityError(
        'a human-verified value requires a verifier id, and no other verification state may carry one'
      );
    }
    const passage = await this.db
      .select({ id: passages.id })
      .from(passages)
      .where(and(eq(passages.id, input.passageId), eq(passages.ownerId, viewer.userId)))
      .limit(1);
    if (passage[0] === undefined) {
      throw new LibraryNotFoundError('Passage');
    }
    return this.insertOne('value', () =>
      this.db
        .insert(extractedValues)
        .values({
          passageId: input.passageId,
          ownerId: viewer.userId,
          propertyId: input.propertyId.trim(),
          raw: input.raw,
          methodId: input.methodId.trim(),
          authority: input.authority,
          verification: input.verification,
          verifiedBy: wantsVerifier ? input.verifiedBy : null,
        })
        .returning()
    );
  }

  /**
   * The viewer's documents. An unauthenticated caller gets nothing — an empty
   * list, never another owner's material.
   */
  async listDocuments(): Promise<DocumentRow[]> {
    if (this.viewer === null) {
      return [];
    }
    return this.db
      .select()
      .from(documents)
      .where(eq(documents.ownerId, this.viewer.userId))
      .orderBy(documents.createdAt);
  }

  /** The viewer's recorded values, oldest first. Unauthenticated: nothing. */
  async listValues(): Promise<ValueRow[]> {
    if (this.viewer === null) {
      return [];
    }
    return this.db
      .select()
      .from(extractedValues)
      .where(eq(extractedValues.ownerId, this.viewer.userId))
      .orderBy(extractedValues.createdAt);
  }

  /**
   * A document together with its evidence — every passage and every value,
   * each still carrying its locator, method, authority, and verification
   * state. Missing and foreign documents are indistinguishable: both return
   * null, so invisibility never leaks existence.
   */
  async getDocument(
    documentId: string
  ): Promise<{ document: DocumentRow; passages: PassageRow[]; values: ValueRow[] } | null> {
    if (this.viewer === null) {
      return null;
    }
    const documentRows = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, this.viewer.userId)))
      .limit(1);
    const document = documentRows[0];
    if (document === undefined) {
      return null;
    }
    const documentPassages = await this.db
      .select()
      .from(passages)
      .where(and(eq(passages.documentId, documentId), eq(passages.ownerId, this.viewer.userId)))
      .orderBy(passages.createdAt);
    let documentValues: ValueRow[] = [];
    if (documentPassages.length > 0) {
      documentValues = await this.db
        .select()
        .from(extractedValues)
        .where(
          and(
            eq(extractedValues.ownerId, this.viewer.userId),
            inArray(
              extractedValues.passageId,
              documentPassages.map((passage) => passage.id)
            )
          )
        )
        .orderBy(extractedValues.createdAt);
    }
    return { document, passages: documentPassages, values: documentValues };
  }
}
