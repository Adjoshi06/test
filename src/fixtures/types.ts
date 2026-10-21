// Types for the synthetic fixture corpus. The corpus is DATA — products,
// documents, passages, values — shaped exactly like the library's domain
// types, so the loader can seed it through the real services unchanged.

import type { Authority, DocumentKind } from '@/lib/library/types';
import type { NewMethod, NewMethodEdge } from '@/lib/registry/types';

/** The four product families the office selects across. Closed set. */
export type ProductCategory = 'seating' | 'lighting' | 'tile' | 'ceilings';

/** A synthetic firm member. Emails use the reserved `.test` TLD. */
export interface CorpusUser {
  /** Corpus-local key documents and verifiers address the user by. */
  key: string;
  email: string;
  displayName: string;
}

/** A product the corpus is about. One product maps to one product-doc document. */
export interface CorpusProduct {
  key: string;
  name: string;
  category: ProductCategory;
  /** The `product-doc` document holding the product's evidence. */
  documentKey: string;
}

/** A place in a document: exact locator plus the verbatim quote sitting there. */
export interface CorpusPassage {
  /** Document-local key values address the passage by. */
  key: string;
  /** e.g. 'p. 12, §4.2' or 'msg 14 Mar, author PM'. */
  locator: string;
  /** Verbatim span from the document — synthetic, but quoted verbatim. */
  quote: string;
}

interface CorpusValueSubject {
  /** The document-local passage key this value sits on. */
  passage: string;
  /** Canonical property, e.g. 'flame-spread'. */
  propertyId: string;
  /** Exactly as the source words it. */
  raw: string;
  /** A methods-registry id, e.g. 'en-13501-1:2018' | 'astm-e84'. */
  methodId: string;
  authority: Authority;
}

/**
 * The verification claim as a discriminated union, mirroring the library's
 * `NewValue`: a `human-verified` value names its verifier (a corpus user
 * key); no other state may carry one.
 */
type CorpusVerificationClaim =
  | { verification: 'human-verified'; verifiedBy: string }
  | { verification: 'interpreted' | 'machine-read'; verifiedBy?: undefined };

export type CorpusValue = CorpusValueSubject & CorpusVerificationClaim;

/** A synthetic document with its evidence underneath it. */
export interface CorpusDocument {
  key: string;
  /** Every corpus title is marked synthetic — enforced by `validateCorpus`. */
  title: string;
  kind: DocumentKind;
  /** Code excerpts only — e.g. 'US', 'UK'. */
  jurisdiction?: string;
  /** Code excerpts only — e.g. '2018', '2024'. */
  edition?: string;
  /** The corpus user key who owns (can see) this document. */
  owner: string;
  passages: CorpusPassage[];
  values: CorpusValue[];
}

/** A method the corpus values cite beyond the registry's own seed. */
export type CorpusMethod = NewMethod;

/** A comparability edge the corpus account records beyond the registry's seed. */
export type CorpusEdge = NewMethodEdge;

/** The whole corpus the loader seeds. */
export interface FixtureCorpus {
  users: CorpusUser[];
  products: CorpusProduct[];
  methods: CorpusMethod[];
  edges: CorpusEdge[];
  documents: CorpusDocument[];
}
