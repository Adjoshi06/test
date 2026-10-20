// The assembled fixture corpus, plus the sentinels the eval harness authors
// against: deliberate gaps (properties a product genuinely lacks) and the
// adversarial property the corpus deliberately never contains.

import { CORRESPONDENCE_DOCUMENTS } from './correspondence';
import { CODE_DOCUMENTS } from './codes';
import { CEILING_DOCUMENTS, CEILING_PRODUCTS } from './ceilings';
import { CORPUS_EDGES, CORPUS_METHODS } from './methods';
import { LIGHTING_DOCUMENTS, LIGHTING_PRODUCTS } from './lighting';
import { PROJECT_DOCUMENTS } from './project';
import { SEATING_DOCUMENTS, SEATING_PRODUCTS } from './seating';
import { TILE_DOCUMENTS, TILE_PRODUCTS } from './tile';
import { CORPUS_USERS } from './users';
import type { CorpusProduct, FixtureCorpus } from '../types';

/** Properties the corpus deliberately does not record for a product. */
export interface DeliberateGap {
  /** The product key the gap sits on. */
  product: string;
  /** The property the corpus is silent about — for this product only. */
  propertyId: string;
  /** What a real answer's unknown would name as resolving evidence. */
  why: string;
}

export const DELIBERATE_GAPS: readonly DeliberateGap[] = [
  {
    product: 'halden-task-chair',
    propertyId: 'flame-spread',
    why: 'the manufacturer fire certificate is pending — see the Halden correspondence thread',
  },
  {
    product: 'vind-desk-chair',
    propertyId: 'flame-spread',
    why: 'the manufacturer datasheet carries no fire data',
  },
  {
    product: 'aery-floor-lamp',
    propertyId: 'luminous-flux',
    why: 'no LM-79 photometric report exists for the product',
  },
  {
    product: 'kaolin-glass-mosaic',
    propertyId: 'slip-resistance',
    why: 'wall-use mosaic; a floor-use declaration would resolve it',
  },
  {
    product: 'vela-metal-raft',
    propertyId: 'acoustic-nrc',
    why: 'absorption is not measured for the metal raft',
  },
];

/**
 * Properties the corpus never records anywhere — the ground for adversarial
 * eval cases ("does the Prism tile have an antimicrobial coating?"), where
 * the only honest answer is unknown.
 */
export const ADVERSARIAL_PROPERTIES: readonly string[] = ['antimicrobial-coating'];

const PRODUCTS: readonly CorpusProduct[] = [
  ...SEATING_PRODUCTS,
  ...LIGHTING_PRODUCTS,
  ...TILE_PRODUCTS,
  ...CEILING_PRODUCTS,
];

/**
 * The whole corpus: 18 products across the four families, four code excerpts
 * (two jurisdictions × two editions), two briefs, the firm materials standard,
 * and three correspondence threads — 28 documents in all.
 */
export const FIXTURE_CORPUS: FixtureCorpus = {
  users: CORPUS_USERS,
  products: [...PRODUCTS],
  methods: CORPUS_METHODS,
  edges: CORPUS_EDGES,
  documents: [
    ...SEATING_DOCUMENTS,
    ...LIGHTING_DOCUMENTS,
    ...TILE_DOCUMENTS,
    ...CEILING_DOCUMENTS,
    ...CODE_DOCUMENTS,
    ...PROJECT_DOCUMENTS,
    ...CORRESPONDENCE_DOCUMENTS,
  ],
};
