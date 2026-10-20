import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
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
 *   parent row owned by the same user (composite foreign keys). The methods
 *   registry below is the deliberate exception — a shared account, not
 *   per-user material.
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

/**
 * Sign-in sessions. The browser holds the opaque token; the database holds
 * only its SHA-256 hash — a leaked database cannot mint sessions, and expiry
 * is enforced at resolution, not trusted from the client.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** SHA-256 of the opaque session token — never the token itself. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('sessions_token_hash_nonempty', sql`length(trim(${t.tokenHash})) > 0`)]
);

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
 * A product the office selects among — task chairs, luminaires, tiles. The slug
 * is the productId vocabulary the reasoner's records and drafts use, so one
 * term means one thing across the model's proposals and the library's facts.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    /** e.g. 'halden-task-chair' — the productId the reasoner's records carry. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** Browse aid, e.g. 'task chair'; null when uncategorised. */
    category: text('category'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Target for the composite tenancy foreign key on values.
    unique('products_id_owner_key').on(t.id, t.ownerId),
    unique('products_owner_slug_key').on(t.ownerId, t.slug),
    check('products_slug_nonempty', sql`length(trim(${t.slug})) > 0`),
    check('products_name_nonempty', sql`length(trim(${t.name})) > 0`),
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
    /** A methods-registry id, e.g. 'en-13501-1:2018' | 'astm-e84' — the registry is the account of which ids exist. */
    methodId: text('method_id').notNull(),
    authority: authorityEnum('authority').notNull(),
    verification: verificationStateEnum('verification').notNull(),
    /** Present exactly when verification is 'human-verified' (CHECK below). */
    verifiedBy: uuid('verified_by'),
    /**
     * The product this value is about — null for values that are not about a
     * product (code requirements, brief clauses). Sits on the value, not the
     * document, because what is known about a product may come from any
     * knowledge body; authority stays recorded per value and never blends.
     */
    productId: uuid('product_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A value can only sit on a passage of the same owner.
    foreignKey({
      name: 'extracted_values_passage_owner_fkey',
      columns: [t.passageId, t.ownerId],
      foreignColumns: [passages.id, passages.ownerId],
    }),
    // A value can only point at a product of the same owner.
    foreignKey({
      name: 'extracted_values_product_owner_fkey',
      columns: [t.productId, t.ownerId],
      foreignColumns: [products.id, products.ownerId],
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

/**
 * The methods registry — the account of which measurement methods and
 * classification systems exist, and which may be set side by side.
 *
 * Unlike the library tables above, the registry carries no visibility owner:
 * methods and their comparability edges are the firm-wide vocabulary every
 * user's values address, and the account must be one shared truth, not
 * per-user. Comparability is decided only by an explicit edge — matching
 * quantity or name never confers it.
 */

/** A method is either a measurement procedure or a classification system. */
export const methodKindEnum = pgEnum('method_kind', ['measurement', 'classification']);

/**
 * One registered method or classification system. The id is the canonical
 * lowercase slug a value cites as its `methodId`; edition-specific rows (the
 * two EN 13501-1 editions) carry distinct ids so a value addresses an edition
 * precisely.
 */
export const methods = pgTable(
  'methods',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: methodKindEnum('kind').notNull(),
    /** The property dimension the method addresses, e.g. 'fire-performance'. Descriptive only — matching quantities never confer comparability. */
    quantity: text('quantity').notNull(),
    /** Edition year when the row is edition-specific, e.g. '2018'; null otherwise. */
    edition: text('edition'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Lowercase ids keep JS and SQL text ordering in agreement (the edge store
    // relies on it) and keep the cited spelling canonical.
    check('methods_id_lowercase', sql`${t.id} = lower(${t.id})`),
    check('methods_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check('methods_quantity_nonempty', sql`length(trim(${t.quantity})) > 0`),
  ]
);

/**
 * An explicit comparability edge between two distinct methods. Comparability
 * is symmetric, so one row per unordered pair, stored in canonical
 * (lexicographic) direction; the service normalizes before insert and before
 * lookup. `comparable = false` records a *known* incomparability (the
 * Euroclasses vs the E84 classes); the absence of a row refuses too — nothing
 * is comparable without an account.
 */
export const methodEdges = pgTable(
  'method_edges',
  {
    fromMethodId: text('from_method_id')
      .notNull()
      .references(() => methods.id),
    toMethodId: text('to_method_id')
      .notNull()
      .references(() => methods.id),
    comparable: boolean('comparable').notNull(),
    /** Why the edge holds — shown with the verdict, never inferred. */
    note: text('note').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.fromMethodId, t.toMethodId] }),
    // Canonical direction also refuses self-edges: a method never needs an
    // edge to itself, and one pair cannot hold two contradictory rows.
    check('method_edges_canonical_direction', sql`${t.fromMethodId} < ${t.toMethodId}`),
    check('method_edges_note_nonempty', sql`length(trim(${t.note})) > 0`),
  ]
);
