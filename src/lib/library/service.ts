import { and, count, eq, inArray } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { documents, extractedValues, passages, products, users } from '@/db/schema';
import { LibraryAccessError, LibraryIntegrityError, LibraryNotFoundError } from './errors';
import type {
  DocumentRow,
  NewDocument,
  NewPassage,
  NewProduct,
  NewValue,
  PassageRow,
  ProductRow,
  ProductValueEvidence,
  ProductWithCount,
  ValueRow,
  Viewer,
} from './types';

/**
 * Postgres error surface we map on. Drizzle wraps engine errors in a
 * DrizzleQueryError ("Failed query: …") whose `cause` is the original PGlite
 * error carrying the SQLSTATE code and the violated constraint's name.
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

/** The root error of a cause chain — what a LibraryIntegrityError carries. */
function rootCause(e: unknown): unknown {
  let current: unknown = e;
  while (current instanceof Error && current.cause !== undefined && current.cause !== null) {
    current = current.cause;
  }
  return current;
}

/**
 * Map an engine constraint violation to a typed integrity error that says
 * which invariant failed in domain terms. Returns null for anything not
 * recognized so unknown failures surface untouched — never swallowed.
 */
function toIntegrityError(e: unknown): LibraryIntegrityError | null {
  const db = findConstraintError(e);
  if (db === null) {
    return null;
  }
  const cause = rootCause(e);
  switch (db.constraint) {
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
    case 'extracted_values_product_owner_fkey':
      return new LibraryIntegrityError(
        'a value must point at a product that exists and belongs to the same owner',
        { cause }
      );
    case 'products_owner_id_users_id_fk':
      return new LibraryIntegrityError('the product owner must be an existing user', { cause });
    case 'products_owner_slug_key':
      return new LibraryIntegrityError(
        'this product slug is already in the library — one term means one product',
        { cause }
      );
    case 'products_slug_nonempty':
      return new LibraryIntegrityError('product slug must not be empty', { cause });
    case 'products_name_nonempty':
      return new LibraryIntegrityError('product name must not be empty', { cause });
    case 'extracted_values_verified_by_fkey':
      return new LibraryIntegrityError('the verifier must be an existing user', { cause });
    case 'extracted_values_verifier_matches_state':
      return new LibraryIntegrityError(
        'a human-verified value requires a verifier id, and no other verification state may carry one',
        { cause }
      );
    default:
      // Foreign-key and unique violations we name individually above; the
      // remaining 23514 checks are the non-empty rules on columns we did not
      // name individually. Anything else surfaces untouched.
      if (db.code === '23514') {
        return new LibraryIntegrityError('a required library field must not be empty', {
          constraint: db.constraint,
          cause,
        });
      }
      if (db.code === '23505') {
        return new LibraryIntegrityError('this library record already exists', {
          constraint: db.constraint,
          cause,
        });
      }
      return null;
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
   * Record a product: the slug is the productId vocabulary the reasoner's
   * records and drafts carry, so one term means one product.
   */
  async createProduct(input: NewProduct): Promise<ProductRow> {
    const viewer = this.requireViewer();
    if (!input.slug.trim()) {
      throw new LibraryIntegrityError('product slug must not be empty');
    }
    if (!input.name.trim()) {
      throw new LibraryIntegrityError('product name must not be empty');
    }
    return this.insertOne('product', () =>
      this.db
        .insert(products)
        .values({
          ownerId: viewer.userId,
          slug: input.slug.trim(),
          name: input.name.trim(),
          category: input.category?.trim() || null,
        })
        .returning()
    );
  }

  /**
   * Record a value under its evidence. The passage — document, locator,
   * verbatim quote — must already exist and belong to the viewer: the
   * persistence layer rejects any value that cannot resolve to a place in a
   * source document. When the value is about a product, the product must
   * exist and belong to the viewer too.
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
    // A value may name its product; when it does, that product must be the
    // viewer's. Missing and foreign products are indistinguishable.
    if (input.productId !== undefined) {
      const product = await this.db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.ownerId, viewer.userId)))
        .limit(1);
      if (product[0] === undefined) {
        throw new LibraryNotFoundError('Product');
      }
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
          productId: input.productId ?? null,
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

  /**
   * The viewer's products with how many recorded values are about each — the
   * browse view. Unauthenticated callers get nothing — an empty list, never
   * another owner's material.
   */
  async listProducts(): Promise<ProductWithCount[]> {
    if (this.viewer === null) {
      return [];
    }
    const rows = await this.db
      .select({ product: products, valueCount: count(extractedValues.id) })
      .from(products)
      .leftJoin(
        extractedValues,
        and(
          eq(extractedValues.productId, products.id),
          eq(extractedValues.ownerId, this.viewer.userId)
        )
      )
      .where(eq(products.ownerId, this.viewer.userId))
      .groupBy(products.id)
      .orderBy(products.createdAt);
    return rows.map((row) => ({ product: row.product, valueCount: Number(row.valueCount) }));
  }

  /**
   * Everything known about a product: each value about it with the evidence it
   * resolves to — document, locator, verbatim quote, verifier. Missing,
   * foreign, and unauthenticated lookups are indistinguishable: all return
   * null, so invisibility never leaks existence.
   */
  async getProduct(
    slug: string
  ): Promise<{ product: ProductRow; values: ProductValueEvidence[] } | null> {
    if (this.viewer === null) {
      return null;
    }
    const productRows = await this.db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.ownerId, this.viewer.userId)))
      .limit(1);
    const product = productRows[0];
    if (product === undefined) {
      return null;
    }
    const evidence = await this.db
      .select({
        value: extractedValues,
        documentId: documents.id,
        documentTitle: documents.title,
        documentKind: documents.kind,
        documentJurisdiction: documents.jurisdiction,
        documentEdition: documents.edition,
        locator: passages.locator,
        quote: passages.quote,
        verifiedByName: users.displayName,
      })
      .from(extractedValues)
      .innerJoin(passages, eq(extractedValues.passageId, passages.id))
      .innerJoin(documents, eq(passages.documentId, documents.id))
      .leftJoin(users, eq(extractedValues.verifiedBy, users.id))
      .where(
        and(
          eq(extractedValues.productId, product.id),
          eq(extractedValues.ownerId, this.viewer.userId)
        )
      )
      .orderBy(extractedValues.createdAt);
    return {
      product,
      values: evidence.map((row) => ({
        value: row.value,
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        documentKind: row.documentKind,
        documentJurisdiction: row.documentJurisdiction,
        documentEdition: row.documentEdition,
        locator: row.locator,
        quote: row.quote,
        verifiedByName: row.verifiedByName,
      })),
    };
  }

  /**
   * Distinct (property, method) pairs recorded anywhere in the viewer's
   * library — the substrate the product page computes unknowns from
   * deterministically: a property the library knows about elsewhere but holds
   * no value for on this product is not-found, and the methods seen elsewhere
   * say what would resolve it.
   */
  async listLibraryProperties(): Promise<Array<{ propertyId: string; methodId: string }>> {
    if (this.viewer === null) {
      return [];
    }
    return this.db
      .selectDistinct({
        propertyId: extractedValues.propertyId,
        methodId: extractedValues.methodId,
      })
      .from(extractedValues)
      .where(eq(extractedValues.ownerId, this.viewer.userId))
      .orderBy(extractedValues.propertyId, extractedValues.methodId);
  }
}
