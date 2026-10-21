import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { UnknownRow } from '@/app/products/unknown-row';
import { ValueCard } from '@/app/products/value-card';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { extractedValues, users } from '@/db/schema';
import {
  LibraryAccessError,
  LibraryIntegrityError,
  LibraryNotFoundError,
} from '@/lib/library/errors';
import { LibraryService } from '@/lib/library/service';
import type { ProductRow, ProductValueEvidence, ValueRow } from '@/lib/library/types';
import {
  buildProductView,
  verificationLabel,
  type KnownValueView,
  type UnknownPropertyView,
} from '@/lib/products/view';

function first<T>(rows: T[]): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error('expected a row, got none');
  }
  return row;
}

describe('products — library read paths', () => {
  let db: LibraryDb;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, documents, passages, extracted_values, products CASCADE`);
  });

  async function seedUser(email: string): Promise<string> {
    const inserted = await db
      .insert(users)
      .values({ email, displayName: email })
      .returning({ id: users.id });
    return first(inserted).id;
  }

  /** A product of the given owner with one recorded value about it. */
  async function seedProductWithEvidence(
    ownerId: string
  ): Promise<{ product: ProductRow; evidence: ProductValueEvidence }> {
    const library = new LibraryService(db, { userId: ownerId });
    const product = await library.createProduct({
      slug: 'halden-task-chair',
      name: 'Halden task chair',
      category: 'task chair',
    });
    const document = await library.createDocument({
      title: 'Halden task chair — technical data sheet (synthetic fixture)',
      kind: 'product-doc',
    });
    const passage = await library.addPassage({
      documentId: document.id,
      locator: 'p. 4, §2.1',
      quote: 'Seat height adjustable 42–55 cm via gas lift.',
    });
    await library.recordValue({
      passageId: passage.id,
      productId: product.id,
      propertyId: 'seat-height-adjustable',
      raw: 'Seat height adjustable 42–55 cm',
      methodId: 'en-1335',
      authority: 'product-doc',
      verification: 'human-verified',
      verifiedBy: ownerId,
    });
    const detail = await library.getProduct('halden-task-chair');
    if (detail === null) {
      throw new Error('expected the seeded product to be readable');
    }
    return { product, evidence: first(detail.values) };
  }

  it('getProduct returns the product with each value and its evidence: document, locator, quote, verifier', async () => {
    const ownerId = await seedUser('a@firm.example');
    const { evidence } = await seedProductWithEvidence(ownerId);

    expect(evidence.value.propertyId).toBe('seat-height-adjustable');
    expect(evidence.documentTitle).toContain('Halden task chair');
    expect(evidence.documentKind).toBe('product-doc');
    expect(evidence.locator).toBe('p. 4, §2.1');
    expect(evidence.quote).toBe('Seat height adjustable 42–55 cm via gas lift.');
    expect(evidence.verifiedByName).toBe('a@firm.example');
  });

  it('a value cannot point at another owner’s product — missing and foreign are indistinguishable', async () => {
    const ownerA = await seedUser('a@firm.example');
    const ownerB = await seedUser('b@firm.example');
    const { product } = await seedProductWithEvidence(ownerA);

    const libraryB = new LibraryService(db, { userId: ownerB });
    const document = await libraryB.createDocument({
      title: 'B note (synthetic fixture)',
      kind: 'product-doc',
    });
    const passage = await libraryB.addPassage({
      documentId: document.id,
      locator: 'p. 1, §1',
      quote: 'A verbatim quote.',
    });
    await expect(
      libraryB.recordValue({
        passageId: passage.id,
        productId: product.id,
        propertyId: 'finish-color',
        raw: 'black',
        methodId: 'ral-classic',
        authority: 'product-doc',
        verification: 'interpreted',
      })
    ).rejects.toBeInstanceOf(LibraryNotFoundError);
    await expect(libraryB.getProduct('halden-task-chair')).resolves.toBeNull();
  });

  it('the engine rejects a cross-owner product linkage even when the service check is bypassed', async () => {
    const ownerA = await seedUser('a@firm.example');
    const ownerB = await seedUser('b@firm.example');
    const { product, evidence } = await seedProductWithEvidence(ownerA);

    await expect(
      db.insert(extractedValues).values({
        passageId: evidence.value.passageId,
        ownerId: ownerB,
        propertyId: 'finish-color',
        raw: 'black',
        methodId: 'ral-classic',
        authority: 'product-doc',
        verification: 'interpreted',
        productId: product.id,
      })
    ).rejects.toThrow();
  });

  it('product slugs are unique per owner', async () => {
    const ownerId = await seedUser('a@firm.example');
    const library = new LibraryService(db, { userId: ownerId });
    await library.createProduct({ slug: 'halden-task-chair', name: 'Halden task chair' });
    await expect(
      library.createProduct({ slug: 'halden-task-chair', name: 'Another Halden' })
    ).rejects.toBeInstanceOf(LibraryIntegrityError);
  });

  it('listProducts counts the values about each product; unauthenticated callers get nothing', async () => {
    const ownerId = await seedUser('a@firm.example');
    const { product } = await seedProductWithEvidence(ownerId);

    const library = new LibraryService(db, { userId: ownerId });
    const other = await library.createProduct({
      slug: 'vind-desk-chair',
      name: 'Vind desk chair',
    });
    const products = await library.listProducts();
    expect(products).toHaveLength(2);
    const halden = products.find((p) => p.product.id === product.id);
    const vind = products.find((p) => p.product.id === other.id);
    expect(halden?.valueCount).toBe(1);
    expect(vind?.valueCount).toBe(0);

    const anonymous = new LibraryService(db, null);
    await expect(anonymous.listProducts()).resolves.toEqual([]);
    await expect(anonymous.getProduct('halden-task-chair')).resolves.toBeNull();
    await expect(anonymous.listLibraryProperties()).resolves.toEqual([]);
    await expect(anonymous.createProduct({ slug: 'x', name: 'X' })).rejects.toBeInstanceOf(
      LibraryAccessError
    );
  });

  it('listLibraryProperties returns the distinct property/method pairs recorded in the viewer’s library', async () => {
    const ownerId = await seedUser('a@firm.example');
    const library = new LibraryService(db, { userId: ownerId });
    const product = await library.createProduct({
      slug: 'halden-task-chair',
      name: 'Halden task chair',
    });
    const document = await library.createDocument({
      title: 'Sheets (synthetic fixture)',
      kind: 'product-doc',
    });
    const passageOne = await library.addPassage({
      documentId: document.id,
      locator: 'p. 5, §3.2',
      quote: 'Flame spread: Class B-s1, d0 per EN 13501-1.',
    });
    const passageTwo = await library.addPassage({
      documentId: document.id,
      locator: 'p. 6, §3.3',
      quote: 'Flame spread Class A per ASTM E84.',
    });
    await library.recordValue({
      passageId: passageOne.id,
      productId: product.id,
      propertyId: 'flame-spread-class',
      raw: 'B-s1, d0',
      methodId: 'en-13501-1',
      authority: 'product-doc',
      verification: 'machine-read',
    });
    await library.recordValue({
      passageId: passageTwo.id,
      productId: product.id,
      propertyId: 'flame-spread-class',
      raw: 'Class A',
      methodId: 'astm-e84',
      authority: 'product-doc',
      verification: 'machine-read',
    });

    await expect(library.listLibraryProperties()).resolves.toEqual([
      { propertyId: 'flame-spread-class', methodId: 'astm-e84' },
      { propertyId: 'flame-spread-class', methodId: 'en-13501-1' },
    ]);
  });
});

// --- View model ---------------------------------------------------------------

function valueRow(overrides: Partial<ValueRow>): ValueRow {
  return {
    id: randomUUID(),
    passageId: randomUUID(),
    ownerId: randomUUID(),
    productId: randomUUID(),
    propertyId: 'flame-spread-class',
    raw: 'B-s1, d0',
    methodId: 'en-13501-1',
    authority: 'product-doc',
    verification: 'machine-read',
    verifiedBy: null,
    createdAt: new Date('2026-10-20T12:00:00Z'),
    ...overrides,
  };
}

function evidenceRow(value: ValueRow): ProductValueEvidence {
  return {
    value,
    documentId: randomUUID(),
    documentTitle: 'Mera conference chair — technical data sheet (synthetic fixture)',
    documentKind: 'product-doc',
    documentJurisdiction: null,
    documentEdition: null,
    locator: 'p. 5, §3.2',
    quote: 'Flame spread: Class B-s1, d0 per EN 13501-1.',
    verifiedByName: value.verifiedBy === null ? null : 'Mara (library)',
  };
}

const productRow: ProductRow = {
  id: randomUUID(),
  ownerId: randomUUID(),
  slug: 'halden-task-chair',
  name: 'Halden task chair',
  category: 'task chair',
  createdAt: new Date('2026-10-20T12:00:00Z'),
};

describe('product page view model — unknowns are computed, not judged', () => {
  it('a property recorded elsewhere but missing here is not-found, with the methods seen elsewhere as resolution', () => {
    const known = evidenceRow(
      valueRow({
        propertyId: 'seat-height-adjustable',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'en-1335',
      })
    );
    const view = buildProductView(
      productRow,
      [known],
      [
        { propertyId: 'seat-height-adjustable', methodId: 'en-1335' },
        { propertyId: 'flame-spread-class', methodId: 'en-13501-1' },
        { propertyId: 'flame-spread-class', methodId: 'astm-e84' },
      ]
    );

    expect(view.unknowns).toHaveLength(1);
    const unknown = view.unknowns[0];
    if (unknown === undefined) {
      throw new Error('expected one unknown row');
    }
    expect(unknown.propertyId).toBe('flame-spread-class');
    expect(unknown.status).toBe('not-found');
    expect(unknown.reason).toContain('flame-spread-class');
    expect(unknown.wouldResolve).toContain('astm-e84 or en-13501-1');
  });

  it('a property this product already has is not an unknown, even though the library knows other methods for it', () => {
    const known = evidenceRow(valueRow({ propertyId: 'flame-spread-class' }));
    const view = buildProductView(
      productRow,
      [known],
      [{ propertyId: 'flame-spread-class', methodId: 'astm-e84' }]
    );
    expect(view.unknowns).toEqual([]);
  });

  it('a library with no recorded values yields the * unknown — nothing can be compared against', () => {
    const view = buildProductView(productRow, [], []);
    expect(view.unknowns).toHaveLength(1);
    const unknown = view.unknowns[0];
    if (unknown === undefined) {
      throw new Error('expected the * unknown row');
    }
    expect(unknown.propertyId).toBe('*');
    expect(unknown.reason).not.toBe('');
    expect(unknown.wouldResolve).not.toBe('');
  });

  it('the verification states are shown differently because they are different', () => {
    expect(verificationLabel('human-verified', 'Mara (library)')).toBe(
      'verified by Mara (library)'
    );
    expect(verificationLabel('interpreted', null)).toBe('read from the source; not yet checked');
    expect(verificationLabel('machine-read', null)).toBe('extracted from the document');
  });
});

// --- Components ----------------------------------------------------------------

const cardValue: KnownValueView = {
  propertyId: 'flame-spread-class',
  raw: 'B-s1, d0',
  methodId: 'en-13501-1',
  authority: 'product-doc',
  verification: 'interpreted',
  verifiedByName: null,
  recordedOn: '2026-10-20',
  evidence: {
    documentId: randomUUID(),
    documentTitle: 'Mera conference chair — technical data sheet (synthetic fixture)',
    documentKind: 'product-doc',
    documentJurisdiction: 'NYC',
    documentEdition: '2024',
    locator: 'p. 5, §3.2',
    quote: 'Flame spread: Class B-s1, d0 per EN 13501-1.',
  },
};

const verifiedValue: KnownValueView = {
  ...cardValue,
  verification: 'human-verified',
  verifiedByName: 'Mara (library)',
};

const unknownItem: UnknownPropertyView = {
  propertyId: 'flame-spread-class',
  status: 'not-found',
  reason: 'No value for ‘flame-spread-class’ is recorded for this product in the library.',
  wouldResolve: 'A source establishing ‘flame-spread-class’ for this product.',
};

describe('product page components — the evidence contract in markup', () => {
  it('every value shows locator, method, authority and verification state', () => {
    const html = renderToStaticMarkup(<ValueCard value={cardValue} />);
    expect(html).toContain('flame-spread-class');
    expect(html).toContain('B-s1, d0');
    expect(html).toContain('en-13501-1');
    expect(html).toContain('product documentation');
    expect(html).toContain('p. 5, §3.2');
    expect(html).toContain('read from the source; not yet checked');
    expect(html).toContain('recorded 2026-10-20');
  });

  it('an interpreted value never presents as checked; a human-verified value names its verifier', () => {
    const interpreted = renderToStaticMarkup(<ValueCard value={cardValue} />);
    expect(interpreted).not.toContain('verified by');
    expect(interpreted).toContain('not yet checked');

    const verified = renderToStaticMarkup(<ValueCard value={verifiedValue} />);
    expect(verified).toContain('verified by Mara (library)');
  });

  it('evidence is one click away: document, locator and the verbatim quote', () => {
    const html = renderToStaticMarkup(<ValueCard value={cardValue} />);
    expect(html).toContain(
      'Evidence — Mera conference chair — technical data sheet (synthetic fixture)'
    );
    expect(html).toContain('NYC 2024');
    expect(html).toContain('Flame spread: Class B-s1, d0 per EN 13501-1.');
  });

  it('unknowns list their status, reason, and what would resolve them', () => {
    const html = renderToStaticMarkup(<UnknownRow item={unknownItem} />);
    expect(html).toContain('flame-spread-class');
    expect(html).toContain('not-found');
    expect(html).toContain('No value for');
    expect(html).toContain('Would resolve:');
    expect(html).toContain('A source establishing');
  });
});
