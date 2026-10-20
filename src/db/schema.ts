import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Library and evidence model — the substrate every promise in the spec rests on.
 *
 * Invariants enforced here (belt) and in the service layer (braces):
 * - A value cannot persist without its evidence: a passage (document, locator,
 *   verbatim quote) that exists and belongs to the same visibility owner.
 * - Verification state is a closed set; `human-verified` and a verifier id
 *   imply each other — neither can exist alone.
 * - Every row carries its visibility owner; a child row can only point at a
 *   parent row owned by the same user (composite foreign keys).
 */

/** Where a document's authority comes from — the four knowledge bodies. */
export const documentKindEnum = pgEnum('document_kind', [
  'product-doc',
  'code',
  'project',
  'correspondence',
]);

/** Authority recorded per value (spec: never blended, always recorded). */
export const authorityEnum = pgEnum('authority', [
  'product-doc',
  'code',
  'project',
  'correspondence',
]);

/**
 * How a value's verification stands (spec: shown differently because they are
 * different). Closed set — anything else is rejected by the enum and by the
 * service types.
 */
export const verificationStateEnum = pgEnum('verification_state', [
  'human-verified',
  'interpreted',
  'machine-read',
]);

/**
 * Visibility owners. Sign-in is a later task; users exist now because every
 * row must carry its owner.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Manufacturer literature, code excerpts, briefs, correspondence. */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    kind: documentKindEnum('kind').notNull(),
    /** Only meaningful for code excerpts; null otherwise. */
    jurisdiction: text('jurisdiction'),
    edition: text('edition'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Target for the composite tenancy foreign keys on child rows.
    unique('documents_id_owner_key').on(t.id, t.ownerId),
    check('documents_title_nonempty', sql`length(trim(${t.title})) > 0`),
  ]
);

/**
 * A place in a document: an exact locator plus the verbatim quote sitting
 * there. Values point at a passage — never at a document alone.
 */
export const passages = pgTable(
  'passages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    /** e.g. 'p. 12, §4.2' or 'msg 14 Mar, author PM'. */
    locator: text('locator').notNull(),
    /** Verbatim span from the document — the quote the evidence shows. */
    quote: text('quote').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('passages_id_owner_key').on(t.id, t.ownerId),
    // A passage can only live inside a document of the same owner.
    foreignKey({
      name: 'passages_document_owner_fkey',
      columns: [t.documentId, t.ownerId],
      foreignColumns: [documents.id, documents.ownerId],
    }),
    // One verbatim quote per place: a locator addresses exactly one passage.
    unique('passages_document_locator_key').on(t.documentId, t.locator),
    check('passages_locator_nonempty', sql`length(trim(${t.locator})) > 0`),
    check('passages_quote_nonempty', sql`length(trim(${t.quote})) > 0`),
  ]
);

/**
 * An extracted value: what the source says (raw, in the source's own words),
 * under which measurement method, with which authority, and how far it is
 * verified. Recorded by the library or a reviewer — never by the model.
 */
export const extractedValues = pgTable(
  'extracted_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    passageId: uuid('passage_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    /** Canonical property, e.g. 'fire-rating'. */
    propertyId: text('property_id').notNull(),
    /** Exactly as the source words it. */
    raw: text('raw').notNull(),
    /** e.g. 'en-13501-1' | 'astm-e84'. The methods registry lands separately. */
    methodId: text('method_id').notNull(),
    authority: authorityEnum('authority').notNull(),
    verification: verificationStateEnum('verification').notNull(),
    /** Present exactly when verification is 'human-verified' (CHECK below). */
    verifiedBy: uuid('verified_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A value can only sit on a passage of the same owner.
    foreignKey({
      name: 'extracted_values_passage_owner_fkey',
      columns: [t.passageId, t.ownerId],
      foreignColumns: [passages.id, passages.ownerId],
    }),
    // A verifier must be a real user.
    foreignKey({
      name: 'extracted_values_verified_by_fkey',
      columns: [t.verifiedBy],
      foreignColumns: [users.id],
    }),
    check('extracted_values_property_nonempty', sql`length(trim(${t.propertyId})) > 0`),
    check('extracted_values_raw_nonempty', sql`length(trim(${t.raw})) > 0`),
    check('extracted_values_method_nonempty', sql`length(trim(${t.methodId})) > 0`),
    // 'human-verified' and a verifier id imply each other — in both directions.
    check(
      'extracted_values_verifier_matches_state',
      sql`(${t.verification} = 'human-verified') = (${t.verifiedBy} is not null)`
    ),
  ]
);
