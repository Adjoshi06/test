import type { NewMethod, NewMethodEdge } from './types';

/**
 * The seeded methods account — real classification systems and test methods
 * under their canonical ids. The seeded pairs are the spec's named examples:
 *
 * - The two EN 13501-1 editions (2007, 2018) are comparable — successive
 *   editions of one classification scheme whose Euroclass definitions are
 *   unchanged.
 * - The ASTM E84 classes are known NOT comparable with either Euroclasses
 *   edition — different test methods and class schemes, however alike the
 *   labels look.
 * - ASTM E648 is held with no edges at all: it addresses the same
 *   `fire-performance` quantity as the others, which is exactly the point —
 *   a matching quantity never confers comparability. Its comparisons refuse
 *   with `no-edge` until an account records one.
 *
 * Ids are edition-specific where editions matter so a value addresses an
 * edition precisely. Edges are listed in canonical (from < to) direction —
 * the service would normalize anyway.
 */
export const REGISTRY_SEED: { methods: NewMethod[]; edges: NewMethodEdge[] } = {
  methods: [
    {
      id: 'en-13501-1:2007',
      name: 'EN 13501-1:2007 — fire classification of construction products (Euroclasses)',
      kind: 'classification',
      quantity: 'fire-performance',
      edition: '2007',
    },
    {
      id: 'en-13501-1:2018',
      name: 'EN 13501-1:2018 — fire classification of construction products (Euroclasses)',
      kind: 'classification',
      quantity: 'fire-performance',
      edition: '2018',
    },
    {
      id: 'astm-e84',
      name: 'ASTM E84 — surface burning characteristics of building materials',
      kind: 'measurement',
      quantity: 'fire-performance',
    },
    {
      id: 'astm-e648',
      name: 'ASTM E648 — critical radiant flux of floor-covering systems',
      kind: 'measurement',
      quantity: 'fire-performance',
    },
  ],
  edges: [
    {
      fromMethodId: 'en-13501-1:2007',
      toMethodId: 'en-13501-1:2018',
      comparable: true,
      note:
        'Successive editions of one classification scheme — the Euroclass definitions are ' +
        'unchanged, so values from either edition may be set side by side.',
    },
    {
      fromMethodId: 'astm-e84',
      toMethodId: 'en-13501-1:2007',
      comparable: false,
      note:
        'different test methods and class schemes — a Euroclass is not an E84 class, and ' +
        'Steiner-tunnel flame-spread indices cannot be translated into Euroclasses',
    },
    {
      fromMethodId: 'astm-e84',
      toMethodId: 'en-13501-1:2018',
      comparable: false,
      note:
        'different test methods and class schemes — a Euroclass is not an E84 class, and ' +
        'Steiner-tunnel flame-spread indices cannot be translated into Euroclasses',
    },
  ],
};
