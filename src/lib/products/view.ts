// The product page's view model — pure functions over what the library service
// returns. Nothing here invents: a value appears with the evidence the service
// resolved, and an unknown is computed deterministically from what the library
// records elsewhere — never filled, never judged (spec art_Ene8eA8R, "Product
// pages are the same contract with no question").

import type {
  Authority,
  DocumentKind,
  ProductRow,
  ProductValueEvidence,
  VerificationState,
} from '@/lib/library/types';

/** A known value as the product page shows it: value, evidence, state. */
export interface KnownValueView {
  propertyId: string;
  /** Exactly as the source words it. */
  raw: string;
  methodId: string;
  authority: Authority;
  verification: VerificationState;
  /** Present exactly when verification is 'human-verified'. */
  verifiedByName: string | null;
  /** When the library recorded the value (YYYY-MM-DD) — not a claim about when it was verified. */
  recordedOn: string;
  evidence: {
    documentId: string;
    documentTitle: string;
    documentKind: DocumentKind;
    /** Code excerpts only — null otherwise. */
    documentJurisdiction: string | null;
    /** Code excerpts only — null otherwise. */
    documentEdition: string | null;
    locator: string;
    quote: string;
  };
}

/**
 * A property the library knows about elsewhere but holds no value for on this
 * product. `propertyId: '*'` — the reasoner draft's convention — means the
 * library holds no recorded property values at all.
 */
export interface UnknownPropertyView {
  propertyId: string;
  status: 'not-found';
  /** Why it is unknown — never empty. */
  reason: string;
  /** What would resolve it: a document to obtain, a question to ask. */
  wouldResolve: string;
}

/** Everything the product page renders. */
export interface ProductView {
  slug: string;
  name: string;
  category: string | null;
  known: KnownValueView[];
  unknowns: UnknownPropertyView[];
}

/** ISO date (YYYY-MM-DD) of a recorded timestamp, shown as the record date. */
function isoDate(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** Authority label — recorded per value, never blended (spec). */
export function authorityLabel(authority: Authority): string {
  const labels: Record<Authority, string> = {
    'product-doc': 'product documentation',
    code: 'code',
    project: 'project',
    correspondence: 'correspondence',
  };
  return labels[authority];
}

/** Document-kind label for evidence lines. */
export function documentKindLabel(kind: DocumentKind): string {
  const labels: Record<DocumentKind, string> = {
    'product-doc': 'product documentation',
    code: 'code',
    project: 'project',
    correspondence: 'correspondence',
  };
  return labels[kind];
}

/**
 * The five verification states are shown differently because they are
 * different (spec). An interpreted or machine-read value never presents as
 * checked; a human-verified value names who checked it.
 */
export function verificationLabel(
  verification: VerificationState,
  verifiedByName: string | null
): string {
  switch (verification) {
    case 'human-verified':
      return verifiedByName === null ? 'human-verified' : `verified by ${verifiedByName}`;
    case 'interpreted':
      return 'read from the source; not yet checked';
    case 'machine-read':
      return 'extracted from the document';
  }
}

/** Short badge text for the verification state. */
export function verificationBadge(verification: VerificationState): string {
  switch (verification) {
    case 'human-verified':
      return 'human-verified';
    case 'interpreted':
      return 'interpreted';
    case 'machine-read':
      return 'machine-read';
  }
}

/**
 * Compute the product page's view. `libraryProperties` — the distinct
 * (property, method) pairs recorded anywhere in the viewer's library — is what
 * makes unknowns honest: a property the library knows about elsewhere but has
 * no value for here is not-found, and the methods it is measured by elsewhere
 * say what would resolve it. Nothing is inferred beyond that.
 */
export function buildProductView(
  product: ProductRow,
  values: ProductValueEvidence[],
  libraryProperties: ReadonlyArray<{ propertyId: string; methodId: string }>
): ProductView {
  const known: KnownValueView[] = values.map((entry) => ({
    propertyId: entry.value.propertyId,
    raw: entry.value.raw,
    methodId: entry.value.methodId,
    authority: entry.value.authority,
    verification: entry.value.verification,
    verifiedByName: entry.verifiedByName,
    recordedOn: isoDate(entry.value.createdAt),
    evidence: {
      documentId: entry.documentId,
      documentTitle: entry.documentTitle,
      documentKind: entry.documentKind,
      documentJurisdiction: entry.documentJurisdiction,
      documentEdition: entry.documentEdition,
      locator: entry.locator,
      quote: entry.quote,
    },
  }));

  const knownProperties = new Set(known.map((entry) => entry.propertyId));

  // Distinct methods seen elsewhere per missing property — the deterministic
  // basis of the "what would resolve it" line.
  const methodsElsewhere = new Map<string, Set<string>>();
  for (const { propertyId, methodId } of libraryProperties) {
    if (knownProperties.has(propertyId)) {
      continue;
    }
    const methods = methodsElsewhere.get(propertyId) ?? new Set<string>();
    methods.add(methodId);
    methodsElsewhere.set(propertyId, methods);
  }

  const unknowns: UnknownPropertyView[] =
    libraryProperties.length === 0
      ? [
          {
            propertyId: '*',
            status: 'not-found',
            reason: 'The library holds no recorded property values.',
            wouldResolve:
              'Source documents recorded into the library — values cannot be asserted without evidence.',
          },
        ]
      : [...methodsElsewhere.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([propertyId, methods]) => ({
            propertyId,
            status: 'not-found' as const,
            reason: `No value for '${propertyId}' is recorded for this product in the library.`,
            wouldResolve:
              methods.size > 0
                ? `A source establishing '${propertyId}' for this product — measured per ${[
                    ...methods,
                  ]
                    .sort()
                    .join(' or ')}, as recorded elsewhere in the library.`
                : `A source establishing '${propertyId}' for this product.`,
          }));

  return {
    slug: product.slug,
    name: product.name,
    category: product.category,
    known,
    unknowns,
  };
}
