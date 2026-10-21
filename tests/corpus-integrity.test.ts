import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createDb, type LibraryDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { documents, extractedValues, passages, users } from '@/db/schema';
import { LibraryService } from '@/lib/library/service';
import { RegistryService } from '@/lib/registry/service';
import { seedFixtureCorpus, validateCorpus } from '@/fixtures/loader';
import { FixtureSeedError } from '@/fixtures/errors';
import { ADVERSARIAL_PROPERTIES, DELIBERATE_GAPS, FIXTURE_CORPUS } from '@/fixtures/corpus';
import type { FixtureCorpus } from '@/fixtures/types';

/** The viewer id for a corpus user key — a missing key stops the test here. */
function userId(summary: Awaited<ReturnType<typeof seedFixtureCorpus>>, key: string): string {
  const id = summary.userIds[key];
  if (id === undefined) {
    throw new Error(`seed summary is missing user key ${key}`);
  }
  return id;
}

describe('fixture corpus — static integrity', () => {
  it('passes whole-corpus validation with zero problems', () => {
    expect(validateCorpus(FIXTURE_CORPUS)).toEqual([]);
  });

  it('carries 14–18 products across all four families', () => {
    expect(FIXTURE_CORPUS.products.length).toBeGreaterThanOrEqual(14);
    expect(FIXTURE_CORPUS.products.length).toBeLessThanOrEqual(18);
    const categories = new Set(FIXTURE_CORPUS.products.map((p) => p.category));
    expect([...categories].sort()).toEqual(['ceilings', 'lighting', 'seating', 'tile']);
  });

  it('marks every document title synthetic', () => {
    for (const document of FIXTURE_CORPUS.documents) {
      expect(document.title.toLowerCase()).toContain('synthetic');
    }
  });

  it('covers all four knowledge bodies', () => {
    const kinds = new Set(FIXTURE_CORPUS.documents.map((d) => d.kind));
    expect([...kinds].sort()).toEqual(['code', 'correspondence', 'product-doc', 'project']);
  });

  it('carries two code jurisdictions with two editions each', () => {
    const codes = FIXTURE_CORPUS.documents.filter((d) => d.kind === 'code');
    const byJurisdiction = new Map<string, Set<string>>();
    for (const code of codes) {
      const { jurisdiction, edition } = code;
      if (jurisdiction === undefined || edition === undefined) {
        throw new Error(`code document ${code.key} must carry jurisdiction and edition`);
      }
      const editions = byJurisdiction.get(jurisdiction) ?? new Set<string>();
      editions.add(edition);
      byJurisdiction.set(jurisdiction, editions);
    }
    expect(byJurisdiction.size).toBe(2);
    for (const editions of byJurisdiction.values()) {
      expect(editions.size).toBe(2);
    }
  });

  it('uses all three verification states', () => {
    const states = new Set(
      FIXTURE_CORPUS.documents.flatMap((d) => d.values.map((v) => v.verification))
    );
    expect([...states].sort()).toEqual(['human-verified', 'interpreted', 'machine-read']);
  });

  it('sets up the comparable-method pair across both EN 13501-1 editions', () => {
    const methodsUsed = new Set(
      FIXTURE_CORPUS.documents.flatMap((d) => d.values.map((v) => v.methodId))
    );
    expect(methodsUsed.has('en-13501-1:2007')).toBe(true); // Vela (scan)
    expect(methodsUsed.has('en-13501-1:2018')).toBe(true); // Fjell, Tove, Hull
    expect(methodsUsed.has('astm-e84')).toBe(true); // Mera, Prism, Basalt
  });

  it('records the authority conflict under both code and project authority', () => {
    const authorities = new Set(
      FIXTURE_CORPUS.documents
        .flatMap((d) => d.values)
        .filter((v) => v.propertyId === 'floor-fire-requirement')
        .map((v) => v.authority)
    );
    expect(authorities.has('code')).toBe(true); // ADB 2019 §9.4, ADB 2026 §9.6
    expect(authorities.has('project')).toBe(true); // firm standard §3.1
  });

  it('keeps every deliberate gap genuinely empty', () => {
    for (const gap of DELIBERATE_GAPS) {
      const product = FIXTURE_CORPUS.products.find((p) => p.key === gap.product);
      if (product === undefined) {
        throw new Error(`gap product ${gap.product} exists`);
      }
      const document = FIXTURE_CORPUS.documents.find((d) => d.key === product.documentKey);
      if (document === undefined) {
        throw new Error(`gap product ${gap.product} has a document`);
      }
      const values = document.values.filter((v) => v.propertyId === gap.propertyId);
      expect(values, `${gap.product} has no '${gap.propertyId}' value`).toEqual([]);
    }
  });

  it('keeps the adversarial property absent from every property and quote', () => {
    for (const adversarial of ADVERSARIAL_PROPERTIES) {
      for (const document of FIXTURE_CORPUS.documents) {
        expect(
          document.values.some((v) => v.propertyId === adversarial),
          `${document.key} records '${adversarial}'`
        ).toBe(false);
        expect(
          document.passages.some((p) => p.quote.toLowerCase().includes(adversarial)),
          `${document.key} quotes '${adversarial}'`
        ).toBe(false);
      }
    }
  });
});

describe('fixture corpus — seeded integrity', () => {
  let db: LibraryDb;

  beforeEach(async () => {
    db = createDb();
    await runMigrations(db);
    await db.execute(sql`TRUNCATE users, documents, passages, extracted_values CASCADE`);
    await db.execute(sql`TRUNCATE methods, method_edges CASCADE`);
  });

  it('seeds the corpus through the real services', async () => {
    const summary = await seedFixtureCorpus(db);
    expect(summary.documentCount).toBe(FIXTURE_CORPUS.documents.length);
    expect(summary.passageCount).toBe(
      FIXTURE_CORPUS.documents.reduce((total, d) => total + d.passages.length, 0)
    );
    expect(summary.valueCount).toBe(
      FIXTURE_CORPUS.documents.reduce((total, d) => total + d.values.length, 0)
    );
    expect(summary.methodsAdded.length).toBe(FIXTURE_CORPUS.methods.length);
    expect(summary.edgesAdded).toBe(FIXTURE_CORPUS.edges.length);
  });

  it('resolves every value to its place in a synthetic source document', async () => {
    await seedFixtureCorpus(db);
    const rows = await db
      .select({
        valueId: extractedValues.id,
        propertyId: extractedValues.propertyId,
        raw: extractedValues.raw,
        quote: passages.quote,
        locator: passages.locator,
        documentTitle: sql<string>`${documents.title}`,
      })
      .from(extractedValues)
      .innerJoin(passages, eq(passages.id, extractedValues.passageId))
      .innerJoin(documents, eq(documents.id, passages.documentId));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.quote.trim()).not.toBe('');
      expect(row.locator.trim()).not.toBe('');
      expect(row.documentTitle.toLowerCase()).toContain('synthetic');
    }
  });

  it('resolves every value method against the seeded registry', async () => {
    await seedFixtureCorpus(db);
    const registry = new RegistryService(db);
    const registered = new Set((await registry.listMethods()).map((m) => m.id));
    const values = await db.select().from(extractedValues);
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(
        registered.has(value.methodId),
        `value ${value.propertyId} cites registered method ${value.methodId}`
      ).toBe(true);
    }
  });

  it('keeps verifier coupling: human-verified names a user, nothing else does', async () => {
    await seedFixtureCorpus(db);
    const values = await db.select().from(extractedValues);
    const userRows = await db.select().from(users);
    const userIds = new Set(userRows.map((u) => u.id));
    let humanVerified = 0;
    for (const value of values) {
      if (value.verification === 'human-verified') {
        humanVerified += 1;
        const verifier = value.verifiedBy;
        if (verifier === null) {
          throw new Error(`human-verified value ${value.propertyId} carries no verifier`);
        }
        expect(userIds.has(verifier), 'verifier is a real user').toBe(true);
      } else {
        expect(value.verifiedBy, `${value.verification} value carries no verifier`).toBeNull();
      }
    }
    expect(humanVerified).toBeGreaterThan(0);
  });

  it('enforces per-user visibility over the seeded corpus', async () => {
    const summary = await seedFixtureCorpus(db);
    const demo = new LibraryService(db, { userId: userId(summary, 'studio-demo') });
    const lead = new LibraryService(db, { userId: userId(summary, 'studio-lead') });
    const anon = new LibraryService(db, null);

    const demoValues = await demo.listValues();
    const expectedDemoValues = FIXTURE_CORPUS.documents
      .filter((d) => d.owner === 'studio-demo')
      .reduce((total, d) => total + d.values.length, 0);
    expect(demoValues.length).toBe(expectedDemoValues);

    const leadDocuments = await lead.listDocuments();
    expect(leadDocuments.length).toBe(1);
    const leadThread = leadDocuments[0];
    if (leadThread === undefined) {
      throw new Error('the studio lead should see exactly one document');
    }
    expect(leadThread.title).toContain('Meridian');
    // The lead's [private] AV-integration thread stays invisible to the demo
    // user — while the demo user's own Meridian brief stays visible, so the
    // scoping is by ownership, not by title matching.
    const demoDocuments = await demo.listDocuments();
    expect(
      demoDocuments.some((d) => d.title.includes('[private]')),
      "the lead's [private] thread is invisible to the demo user"
    ).toBe(false);
    expect(
      demoDocuments.some((d) => d.title.includes('Meridian Hotel')),
      'the demo user still sees their own Meridian brief'
    ).toBe(true);

    expect(await anon.listValues()).toEqual([]);
    expect(await anon.listDocuments()).toEqual([]);
  });

  it('decides comparability exactly as the corpus structure promises', async () => {
    await seedFixtureCorpus(db);
    const registry = new RegistryService(db);
    // Comparable: successive EN editions (Fjell 2018 vs Vela 2007).
    const editions = await registry.compareMethods('en-13501-1:2018', 'en-13501-1:2007');
    expect(editions.verdict).toBe('comparable');
    expect(editions.basis).toBe('explicit-edge');
    // Known-incomparable: E84 classes are not Euroclasses (Mera/Basalt vs Fjell).
    const e84 = await registry.compareMethods('astm-e84', 'en-13501-1:2018');
    expect(e84.verdict).toBe('not-comparable');
    expect(e84.basis).toBe('known-incomparable');
    // Known-incomparable: ramp R-classes are not pendulum PTV (Terra).
    const slip = await registry.compareMethods('din-51130', 'bs-7976');
    expect(slip.verdict).toBe('not-comparable');
    expect(slip.basis).toBe('known-incomparable');
    // No edge: EN 1021 ignitability is not a Euroclass (Bram), despite the
    // matching fire-performance quantity.
    const ignitability = await registry.compareMethods('en-1021', 'en-13501-1:2018');
    expect(ignitability.verdict).toBe('not-comparable');
    expect(ignitability.basis).toBe('no-edge');
  });

  it('refuses to seed twice — silent duplication would lie to the demo', async () => {
    await seedFixtureCorpus(db);
    await expect(seedFixtureCorpus(db)).rejects.toThrow(FixtureSeedError);
  });

  it('refuses to seed a corpus that fails validation', async () => {
    const broken: FixtureCorpus = {
      ...FIXTURE_CORPUS,
      documents: FIXTURE_CORPUS.documents.map((d) =>
        d.key === 'doc-halden-spec'
          ? {
              ...d,
              values: [
                ...d.values,
                {
                  passage: 'seat-height',
                  propertyId: 'flame-spread',
                  raw: 'B-s1, d0',
                  methodId: 'en-13501-1:2018',
                  authority: 'product-doc',
                  verification: 'interpreted',
                },
              ],
            }
          : d
      ),
    };
    // The Halden flame-spread gap is load-bearing for adversarial eval; a
    // corpus that fills it must not seed.
    await expect(seedFixtureCorpus(db, broken)).rejects.toThrow(/deliberate gap violated/);
  });

  it('refuses to seed a corpus whose values cite unregistered methods', async () => {
    const broken: FixtureCorpus = {
      ...FIXTURE_CORPUS,
      documents: FIXTURE_CORPUS.documents.map((d) =>
        d.key === 'doc-tove-spec'
          ? { ...d, values: d.values.map((v) => ({ ...v, methodId: 'made-up-method' })) }
          : d
      ),
    };
    await expect(seedFixtureCorpus(db, broken)).rejects.toThrow(/unregistered method/);
  });
});
