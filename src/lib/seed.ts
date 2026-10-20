// Dev seed — a synthetic corpus so the app renders real evidence semantics
// before sign-in and ingestion land. Every fixture here is synthetic and
// clearly marked as such (locked decision in the spec); real documents never
// enter this repository. The eval harness keeps its own independent fixture
// set (eval/fixtures.ts) — this seed feeds the running app only.
//
// All writes go through the LibraryService: the seed exercises the same
// integrity and visibility path production data will.

import { eq } from 'drizzle-orm';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { users } from '@/db/schema';
import { LibraryService } from '@/lib/library/service';

/** The dev viewer sign-in will replace — a firm member with a seeded library. */
export const DEV_EMAIL = 'dev@archetype.example';

interface DevSeed {
  userId: string;
}

/** Process-wide in-memory Postgres — one instance, cached across HMR reloads. */
function getDb(): LibraryDb {
  const g = globalThis as typeof globalThis & { __appDb?: LibraryDb };
  if (g.__appDb === undefined) {
    g.__appDb = createDb();
  }
  return g.__appDb;
}

/** The app's database handle until the compose Postgres wiring lands. */
export function getAppDb(): LibraryDb {
  return getDb();
}

async function initialize(): Promise<DevSeed> {
  const db = getDb();
  await runMigrations(db);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, DEV_EMAIL))
    .limit(1);
  const existingUser = existing[0];
  if (existingUser !== undefined) {
    return { userId: existingUser.id };
  }

  const inserted = await db
    .insert(users)
    .values({ email: DEV_EMAIL, displayName: 'Archetype studio (dev seed)' })
    .returning({ id: users.id });
  const devUser = inserted[0];
  if (devUser === undefined) {
    throw new Error('dev seed could not create its user');
  }
  const userId = devUser.id;

  const library = new LibraryService(db, { userId });

  // --- Products (the spec's worked example) ---------------------------------

  const halden = await library.createProduct({
    slug: 'halden-task-chair',
    name: 'Halden task chair',
    category: 'task chair',
  });
  const mera = await library.createProduct({
    slug: 'mera-conference-chair',
    name: 'Mera conference chair',
    category: 'conference chair',
  });
  const vind = await library.createProduct({
    slug: 'vind-desk-chair',
    name: 'Vind desk chair',
    category: 'desk chair',
  });

  // --- Documents ------------------------------------------------------------

  const haldenSheet = await library.createDocument({
    title: 'Halden task chair — technical data sheet (synthetic fixture)',
    kind: 'product-doc',
  });
  const meraSheet = await library.createDocument({
    title: 'Mera conference chair — technical data sheet (synthetic fixture)',
    kind: 'product-doc',
  });
  const vindSheet = await library.createDocument({
    title: 'Vind desk chair — technical data sheet (synthetic fixture)',
    kind: 'product-doc',
  });
  const codeExcerpt = await library.createDocument({
    title: 'IBC excerpts — interior finish (synthetic fixture)',
    kind: 'code',
    jurisdiction: 'NYC',
    edition: '2024',
  });
  const correspondence = await library.createDocument({
    title: 'Correspondence — Halden fire certificate (synthetic fixture)',
    kind: 'correspondence',
  });

  // --- Passages and values --------------------------------------------------
  // Halden: seat height and finish known; flame-spread deliberately
  // unrecorded — the product page must show it as unknown, with the
  // correspondence naming what would resolve it.

  const haldenSeat = await library.addPassage({
    documentId: haldenSheet.id,
    locator: 'p. 4, §2.1',
    quote: 'Seat height adjustable 42–55 cm via gas lift.',
  });
  await library.recordValue({
    passageId: haldenSeat.id,
    productId: halden.id,
    propertyId: 'seat-height-adjustable',
    raw: 'Seat height adjustable 42–55 cm',
    methodId: 'en-1335',
    authority: 'product-doc',
    verification: 'human-verified',
    verifiedBy: userId,
  });

  const haldenFinish = await library.addPassage({
    documentId: haldenSheet.id,
    locator: 'p. 7, §5.3',
    quote: 'Upholstery available in black; other colours by special order.',
  });
  await library.recordValue({
    passageId: haldenFinish.id,
    productId: halden.id,
    propertyId: 'finish-color',
    raw: 'black',
    methodId: 'ral-classic',
    authority: 'product-doc',
    verification: 'machine-read',
  });

  await library.addPassage({
    documentId: correspondence.id,
    locator: 'msg 14 Mar, author PM',
    quote:
      'Manufacturer confirms the Halden fire certificate (EN 13501-1) is expected before delivery; not yet issued.',
  });

  // Mera: every property in the example, including the failing ones.

  const meraSeat = await library.addPassage({
    documentId: meraSheet.id,
    locator: 'p. 3, §1.4',
    quote: 'Fixed seat height 45 cm; not adjustable.',
  });
  await library.recordValue({
    passageId: meraSeat.id,
    productId: mera.id,
    propertyId: 'seat-height-adjustable',
    raw: 'Fixed seat height 45 cm',
    methodId: 'en-1335',
    authority: 'product-doc',
    verification: 'interpreted',
  });

  const meraFire = await library.addPassage({
    documentId: meraSheet.id,
    locator: 'p. 5, §3.2',
    quote: 'Flame spread: Class B-s1, d0 per EN 13501-1.',
  });
  await library.recordValue({
    passageId: meraFire.id,
    productId: mera.id,
    propertyId: 'flame-spread-class',
    raw: 'B-s1, d0',
    methodId: 'en-13501-1',
    authority: 'product-doc',
    verification: 'machine-read',
  });

  const meraFinish = await library.addPassage({
    documentId: meraSheet.id,
    locator: 'p. 7, §5.1',
    quote: 'Shell supplied in signal white.',
  });
  await library.recordValue({
    passageId: meraFinish.id,
    productId: mera.id,
    propertyId: 'finish-color',
    raw: 'signal white',
    methodId: 'ral-classic',
    authority: 'product-doc',
    verification: 'human-verified',
    verifiedBy: userId,
  });

  // Vind: seat height and finish known; flame-spread absent — the second
  // unknown the spec's example shows.

  const vindSeat = await library.addPassage({
    documentId: vindSheet.id,
    locator: 'p. 2, §2.0',
    quote: 'Seat height adjustable 40–52 cm.',
  });
  await library.recordValue({
    passageId: vindSeat.id,
    productId: vind.id,
    propertyId: 'seat-height-adjustable',
    raw: 'adjustable 40–52 cm',
    methodId: 'en-1335',
    authority: 'product-doc',
    verification: 'machine-read',
  });

  const vindFinish = await library.addPassage({
    documentId: vindSheet.id,
    locator: 'p. 6, §4.4',
    quote: 'Available finishes: stone grey, moss green.',
  });
  await library.recordValue({
    passageId: vindFinish.id,
    productId: vind.id,
    propertyId: 'finish-color',
    raw: 'stone grey',
    methodId: 'ral-classic',
    authority: 'product-doc',
    verification: 'interpreted',
  });

  // A code requirement — a value with no product: authority 'code' establishes
  // requirements; it is not a fact about any product.

  const codePassage = await library.addPassage({
    documentId: codeExcerpt.id,
    locator: '§10.3.2, p. 210',
    quote: 'Interior finish in assembly spaces shall be Class A or better.',
  });
  await library.recordValue({
    passageId: codePassage.id,
    propertyId: 'flame-spread-class',
    raw: 'Class A or better',
    methodId: 'astm-e84',
    authority: 'code',
    verification: 'human-verified',
    verifiedBy: userId,
  });

  return { userId };
}

/**
 * Seed once per process. Concurrent first requests await the same promise, so
 * the corpus is written exactly once; later requests reuse the viewer id.
 */
export function ensureDevSeed(): Promise<DevSeed> {
  const g = globalThis as typeof globalThis & { __appSeed?: Promise<DevSeed> };
  if (g.__appSeed === undefined) {
    g.__appSeed = initialize().catch((e: unknown) => {
      // Do not cache a failed boot: the next request retries. The error
      // surfaces — a broken seed is a broken app, never a silent empty one.
      g.__appSeed = undefined;
      throw e;
    });
  }
  return g.__appSeed;
}
