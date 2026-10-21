import type {
  authorityEnum,
  documentKindEnum,
  documents,
  extractedValues,
  passages,
  products,
  verificationStateEnum,
} from '@/db/schema';

/** Where a document's knowledge comes from — the four knowledge bodies. Closed set. */
export type DocumentKind = (typeof documentKindEnum.enumValues)[number];

/** Authority recorded on every value; never blended (spec). Closed set. */
export type Authority = (typeof authorityEnum.enumValues)[number];

/**
 * How far a value is verified (spec: shown differently because they are
 * different). Closed set, derived from the Postgres enum — the database and
 * the types cannot drift.
 */
export type VerificationState = (typeof verificationStateEnum.enumValues)[number];

export type DocumentRow = typeof documents.$inferSelect;
export type PassageRow = typeof passages.$inferSelect;
export type ValueRow = typeof extractedValues.$inferSelect;
export type ProductRow = typeof products.$inferSelect;

/** The authenticated caller. Sign-in lands later; the shape is fixed now. */
export interface Viewer {
  userId: string;
}

export interface NewDocument {
  title: string;
  kind: DocumentKind;
  /** Code excerpts only — e.g. 'NYC'. */
  jurisdiction?: string;
  /** Code excerpts only — e.g. '2024'. */
  edition?: string;
}

export interface NewProduct {
  /** e.g. 'halden-task-chair' — the productId the reasoner's records carry. */
  slug: string;
  name: string;
  /** Browse aid, e.g. 'task chair'. */
  category?: string;
}

/**
 * A value about a product together with the evidence it resolves to — document,
 * locator, verbatim quote, verifier. Everything a product page shows about a
 * known value, assembled by the service (the only read path).
 */
export interface ProductValueEvidence {
  value: ValueRow;
  documentId: string;
  documentTitle: string;
  documentKind: DocumentKind;
  /** Code excerpts only — null otherwise. */
  documentJurisdiction: string | null;
  /** Code excerpts only — null otherwise. */
  documentEdition: string | null;
  locator: string;
  quote: string;
  /** Verifier display name — present exactly when verification is 'human-verified'. */
  verifiedByName: string | null;
}

export interface NewPassage {
  documentId: string;
  /** e.g. 'p. 12, §4.2' or 'msg 14 Mar, author PM'. */
  locator: string;
  /** Verbatim span from the document. */
  quote: string;
}

/** What every value records, regardless of how far it is verified. */
interface ValueSubject {
  passageId: string;
  /** Canonical property, e.g. 'fire-rating'. */
  propertyId: string;
  /** Exactly as the source words it. */
  raw: string;
  /** e.g. 'en-13501-1' | 'astm-e84'. */
  methodId: string;
  authority: Authority;
  /**
   * The product this value is about — the owner's product row must exist.
   * Null for values that are not about a product (code requirements, briefs).
   */
  productId?: string;
}

/**
 * The verification claim as a discriminated union: a `human-verified` value
 * without a verifier id does not type-check, and a verifier id on an
 * `interpreted` or `machine-read` value does not either.
 */
type VerificationClaim =
  | { verification: 'human-verified'; verifiedBy: string }
  | { verification: 'interpreted' | 'machine-read'; verifiedBy?: undefined };

export type NewValue = ValueSubject & VerificationClaim;

/** A product with how many of the viewer's recorded values are about it. */
export interface ProductWithCount {
  product: ProductRow;
  valueCount: number;
}
