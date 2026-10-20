// The fixture loader: seeds the synthetic corpus through the REAL library and
// registry services, so every engine invariant — tenancy, evidence chains,
// verifier/state coupling, the methods account — holds on fixture data too.
// A corpus the loader cannot seed through the real services is a corpus the
// product could not hold.

import { eq } from 'drizzle-orm';
import type { LibraryDb } from '@/db/client';
import { documents, users } from '@/db/schema';
import { LibraryService } from '@/lib/library/service';
import { REGISTRY_SEED } from '@/lib/registry/seed-data';
import { RegistryService } from '@/lib/registry/service';
import { ADVERSARIAL_PROPERTIES, DELIBERATE_GAPS, FIXTURE_CORPUS } from './corpus';
import { FixtureSeedError } from './errors';
import type { CorpusDocument, FixtureCorpus, ProductCategory } from './types';

/** The document kinds a corpus must cover to exercise the whole contract. */
const ALL_KINDS: readonly CorpusDocument['kind'][] = [
  'product-doc',
  'code',
  'project',
  'correspondence',
];

const ALL_CATEGORIES: readonly ProductCategory[] = ['seating', 'lighting', 'tile', 'ceilings'];

const ALL_VERIFICATION_STATES: readonly CorpusDocument['values'][number]['verification'][] = [
  'human-verified',
  'interpreted',
  'machine-read',
];

/** Registry seed method ids — the account the loader does not need to create. */
const REGISTRY_METHOD_IDS: ReadonlySet<string> = new Set(
  REGISTRY_SEED.methods.map((method) => method.id)
);

/**
 * Static corpus integrity — pure, so the tests and the loader share one
 * definition of a sound corpus. Returns every problem found; an empty array
 * means the corpus is internally consistent and structurally complete.
 */
export function validateCorpus(corpus: FixtureCorpus): string[] {
  const problems: string[] = [];
  const problem = (message: string): void => {
    problems.push(message);
  };

  // Users — keys and emails unique; every owner and verifier resolves.
  const userKeys = new Set<string>();
  const userEmails = new Set<string>();
  for (const user of corpus.users) {
    if (userKeys.has(user.key)) problem(`duplicate corpus user key ${user.key}`);
    if (userEmails.has(user.email)) problem(`duplicate corpus user email ${user.email}`);
    userKeys.add(user.key);
    userEmails.add(user.email);
  }

  // Documents — unique keys, synthetic marking, kind-shaped fields, passages.
  const documentKeys = new Set<string>();
  const productDocKeys = new Set<string>();
  const kinds = new Set<CorpusDocument['kind']>();
  for (const document of corpus.documents) {
    if (documentKeys.has(document.key)) problem(`duplicate document key ${document.key}`);
    documentKeys.add(document.key);
    kinds.add(document.kind);
    if (!document.title.toLowerCase().includes('synthetic')) {
      problem(`document ${document.key} title is not marked synthetic: "${document.title}"`);
    }
    if (document.kind === 'code') {
      if (!document.jurisdiction || !document.edition) {
        problem(`code document ${document.key} must carry jurisdiction and edition`);
      }
    } else if (document.jurisdiction !== undefined || document.edition !== undefined) {
      problem(`non-code document ${document.key} must not carry jurisdiction or edition`);
    }
    if (document.kind === 'product-doc') productDocKeys.add(document.key);
    if (!userKeys.has(document.owner)) {
      problem(`document ${document.key} has unknown owner "${document.owner}"`);
    }
    if (document.passages.length === 0) {
      problem(`document ${document.key} has no passages — nothing is anchorable`);
    }
    const passageKeys = new Set<string>();
    const locators = new Set<string>();
    for (const passage of document.passages) {
      if (passageKeys.has(passage.key)) {
        problem(`document ${document.key} has duplicate passage key ${passage.key}`);
      }
      passageKeys.add(passage.key);
      if (locators.has(passage.locator)) {
        problem(`document ${document.key} has duplicate locator "${passage.locator}"`);
      }
      locators.add(passage.locator);
      if (!passage.quote.trim())
        problem(`document ${document.key} passage ${passage.key} has an empty quote`);
    }
  }

  // Methods — unique lowercase ids, no silent redefinition of the registry's
  // own seed, every value's method accounted for.
  const corpusMethodIds = new Set<string>();
  for (const method of corpus.methods) {
    if (corpusMethodIds.has(method.id)) problem(`duplicate corpus method id ${method.id}`);
    if (method.id !== method.id.toLowerCase())
      problem(`corpus method id must be lowercase: ${method.id}`);
    if (REGISTRY_METHOD_IDS.has(method.id)) {
      problem(`corpus method ${method.id} redefines a registry-seeded method`);
    }
    corpusMethodIds.add(method.id);
  }
  const knownMethodIds = new Set<string>([...REGISTRY_METHOD_IDS, ...corpusMethodIds]);
  for (const edge of corpus.edges) {
    if (edge.fromMethodId === edge.toMethodId) {
      problem(`corpus edge ${edge.fromMethodId}↔${edge.toMethodId} is a self-edge`);
    }
    for (const end of [edge.fromMethodId, edge.toMethodId]) {
      if (!knownMethodIds.has(end)) problem(`corpus edge references unknown method ${end}`);
    }
  }

  // Values — evidence chains, verifier coupling, registered methods.
  let humanVerifiedCount = 0;
  let interpretedCount = 0;
  let machineReadCount = 0;
  const methodsUsed = new Set<string>();
  for (const document of corpus.documents) {
    for (const value of document.values) {
      if (!document.passages.some((passage) => passage.key === value.passage)) {
        problem(
          `document ${document.key} value (${value.propertyId}) references unknown passage "${value.passage}"`
        );
      }
      if (!knownMethodIds.has(value.methodId)) {
        problem(
          `document ${document.key} value (${value.propertyId}) cites unregistered method ${value.methodId}`
        );
      }
      methodsUsed.add(value.methodId);
      // A cast caller can sneak a verifier onto any state — checked off the
      // discriminated union as a plain optional, so the impossible shapes stay
      // runtime-rejected without narrowing the value to never.
      const verifier: string | undefined = 'verifiedBy' in value ? value.verifiedBy : undefined;
      if (value.verification === 'human-verified') {
        humanVerifiedCount += 1;
        if (verifier === undefined || !userKeys.has(verifier)) {
          problem(
            `document ${document.key} human-verified value (${value.propertyId}) must name a corpus user as its verifier`
          );
        }
      } else {
        if (verifier !== undefined) {
          problem(
            `document ${document.key} value (${value.propertyId}) carries a verifier without human-verified state`
          );
        }
        if (value.verification === 'interpreted') interpretedCount += 1;
        else machineReadCount += 1;
      }
    }
  }
  for (const state of ALL_VERIFICATION_STATES) {
    const count =
      state === 'human-verified'
        ? humanVerifiedCount
        : state === 'interpreted'
          ? interpretedCount
          : machineReadCount;
    if (count === 0) problem(`corpus must contain at least one '${state}' value`);
  }

  // The corpus must cover every knowledge body the spec names.
  for (const kind of ALL_KINDS) {
    if (!kinds.has(kind)) problem(`corpus must carry at least one '${kind}' document`);
  }

  // Products — one product per product-doc document, all four families.
  if (corpus.products.length < 14 || corpus.products.length > 18) {
    problem(`expected 14–18 products, found ${corpus.products.length}`);
  }
  const productKeys = new Set<string>();
  const claimedDocumentKeys = new Set<string>();
  const categories = new Set<ProductCategory>();
  for (const product of corpus.products) {
    if (productKeys.has(product.key)) problem(`duplicate product key ${product.key}`);
    productKeys.add(product.key);
    categories.add(product.category);
    const document = corpus.documents.find((candidate) => candidate.key === product.documentKey);
    if (document === undefined) {
      problem(`product ${product.key} references unknown document ${product.documentKey}`);
    } else if (document.kind !== 'product-doc') {
      problem(`product ${product.key} must reference a product-doc document, not ${document.kind}`);
    }
    if (claimedDocumentKeys.has(product.documentKey)) {
      problem(`document ${product.documentKey} is claimed by more than one product`);
    }
    claimedDocumentKeys.add(product.documentKey);
  }
  for (const category of ALL_CATEGORIES) {
    if (!categories.has(category)) problem(`corpus must cover the '${category}' family`);
  }
  for (const key of productDocKeys) {
    if (!claimedDocumentKeys.has(key))
      problem(`product-doc document ${key} is not claimed by a product`);
  }

  // Codes — two jurisdictions with editions apiece.
  const jurisdictions = new Set<string>();
  const editionsByJurisdiction = new Map<string, Set<string>>();
  for (const document of corpus.documents) {
    if (document.kind !== 'code' || document.jurisdiction === undefined) continue;
    jurisdictions.add(document.jurisdiction);
    const editions = editionsByJurisdiction.get(document.jurisdiction) ?? new Set<string>();
    if (document.edition !== undefined) editions.add(document.edition);
    editionsByJurisdiction.set(document.jurisdiction, editions);
  }
  if (jurisdictions.size < 2) problem('corpus must carry at least two code jurisdictions');
  for (const [jurisdiction, editions] of editionsByJurisdiction) {
    if (editions.size < 2)
      problem(`code jurisdiction ${jurisdiction} must carry at least two editions`);
  }

  // The structural cases the spec commits the corpus to.
  for (const edition of ['en-13501-1:2007', 'en-13501-1:2018']) {
    if (!methodsUsed.has(edition)) {
      problem(
        `comparable-method pair requires values under both EN 13501-1 editions; ${edition} missing`
      );
    }
  }
  if (!methodsUsed.has('astm-e84')) {
    problem('known-incomparable pair requires a value under astm-e84 alongside an EN edition');
  }
  const conflictAuthorities = new Set<string>();
  for (const document of corpus.documents) {
    for (const value of document.values) {
      if (value.propertyId === 'floor-fire-requirement') conflictAuthorities.add(value.authority);
    }
  }
  if (!(conflictAuthorities.has('code') && conflictAuthorities.has('project'))) {
    problem(
      'authority conflict requires floor-fire-requirement values under both code and project authority'
    );
  }
  for (const gap of DELIBERATE_GAPS) {
    const product = corpus.products.find((candidate) => candidate.key === gap.product);
    if (product === undefined) {
      problem(`deliberate gap names unknown product ${gap.product}`);
      continue;
    }
    const document = corpus.documents.find((candidate) => candidate.key === product.documentKey);
    if (document === undefined) continue; // already reported above
    if (document.values.some((value) => value.propertyId === gap.propertyId)) {
      problem(
        `deliberate gap violated: ${gap.product} carries a '${gap.propertyId}' value — the gap is the point`
      );
    }
  }
  for (const adversarial of ADVERSARIAL_PROPERTIES) {
    const used = corpus.documents.some(
      (document) =>
        document.values.some((value) => value.propertyId === adversarial) ||
        document.passages.some((passage) => passage.quote.toLowerCase().includes(adversarial))
    );
    if (used) {
      problem(`adversarial property '${adversarial}' must not appear anywhere in the corpus`);
    }
  }

  return problems;
}

/** What the loader did — ids and counts a test or demo screen can assert on. */
export interface FixtureSeedSummary {
  /** Corpus user key → database id. */
  userIds: Readonly<Record<string, string>>;
  documentCount: number;
  passageCount: number;
  valueCount: number;
  /** Corpus methods the registry did not yet know — defined by this run. */
  methodsAdded: readonly string[];
  /** Corpus edges added by this run. */
  edgesAdded: number;
}

/**
 * Seed the corpus into a fresh, migrated database. Every write goes through
 * the real services, so engine and service invariants apply to fixture data
 * exactly as they will to real material. Idempotent at the account level
 * (methods and edges), and guarded against double-seeding the library.
 */
export async function seedFixtureCorpus(
  db: LibraryDb,
  corpus: FixtureCorpus = FIXTURE_CORPUS
): Promise<FixtureSeedSummary> {
  const problems = validateCorpus(corpus);
  if (problems.length > 0) {
    throw new FixtureSeedError(`corpus failed validation:\n- ${problems.join('\n- ')}`);
  }
  const existing = await db.select({ id: documents.id }).from(documents).limit(1);
  if (existing.length > 0) {
    throw new FixtureSeedError(
      'the library is not empty — the fixture corpus seeds a fresh, migrated database'
    );
  }

  const registry = new RegistryService(db);
  await registry.seed(); // the four fire methods and their edges, idempotent
  const methodsAdded: string[] = [];
  for (const method of corpus.methods) {
    if ((await registry.getMethod(method.id)) === null) {
      await registry.defineMethod(method);
      methodsAdded.push(method.id);
    }
  }
  const knownPairs = new Set(
    (await registry.listEdges()).map((edge) =>
      [edge.fromMethodId, edge.toMethodId].sort().join('|')
    )
  );
  let edgesAdded = 0;
  for (const edge of corpus.edges) {
    if (!knownPairs.has([edge.fromMethodId, edge.toMethodId].sort().join('|'))) {
      await registry.defineEdge(edge);
      edgesAdded += 1;
    }
  }

  const userIds: Record<string, string> = {};
  for (const user of corpus.users) {
    const found = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
    const existingId = found[0]?.id;
    if (existingId !== undefined) {
      userIds[user.key] = existingId;
      continue;
    }
    const inserted = await db
      .insert(users)
      .values({ email: user.email, displayName: user.displayName })
      .returning({ id: users.id });
    const id = inserted[0]?.id;
    if (id === undefined) {
      throw new FixtureSeedError(`failed to create fixture user ${user.email}`);
    }
    userIds[user.key] = id;
  }

  let passageCount = 0;
  let valueCount = 0;
  for (const document of corpus.documents) {
    const ownerId = userIds[document.owner];
    if (ownerId === undefined) {
      throw new FixtureSeedError(
        `document ${document.key} has unresolvable owner "${document.owner}"`
      );
    }
    const service = new LibraryService(db, { userId: ownerId });
    const created = await service.createDocument({
      title: document.title,
      kind: document.kind,
      jurisdiction: document.jurisdiction,
      edition: document.edition,
    });
    const passageIds = new Map<string, string>();
    for (const passage of document.passages) {
      const row = await service.addPassage({
        documentId: created.id,
        locator: passage.locator,
        quote: passage.quote,
      });
      passageIds.set(passage.key, row.id);
      passageCount += 1;
    }
    for (const value of document.values) {
      const passageId = passageIds.get(value.passage);
      if (passageId === undefined) {
        throw new FixtureSeedError(
          `document ${document.key}: value (${value.propertyId}) references unknown passage "${value.passage}"`
        );
      }
      const claim =
        value.verification === 'human-verified'
          ? (() => {
              const verifierId = userIds[value.verifiedBy];
              if (verifierId === undefined) {
                throw new FixtureSeedError(
                  `document ${document.key}: verifier "${value.verifiedBy}" is not a corpus user`
                );
              }
              return { verification: 'human-verified' as const, verifiedBy: verifierId };
            })()
          : { verification: value.verification, verifiedBy: undefined };
      await service.recordValue({
        passageId,
        propertyId: value.propertyId,
        raw: value.raw,
        methodId: value.methodId,
        authority: value.authority,
        ...claim,
      });
      valueCount += 1;
    }
  }

  return {
    userIds,
    documentCount: corpus.documents.length,
    passageCount,
    valueCount,
    methodsAdded,
    edgesAdded,
  };
}
