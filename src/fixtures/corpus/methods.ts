// The corpus's methods account — the additional measurement methods and
// classification systems the corpus values cite, beyond the four fire methods
// the registry seeds itself (en-13501-1:2007/:2018, astm-e84, astm-e648).
//
// Standard names are cited for realism; the VALUES recorded under them are
// synthetic and represent nothing real.

import type { CorpusEdge, CorpusMethod } from '../types';

export const CORPUS_METHODS: CorpusMethod[] = [
  {
    id: 'stated-range',
    name: 'Manufacturer-stated dimensions and capacities (synthetic corpus account)',
    kind: 'measurement',
    quantity: 'dimensions',
  },
  {
    id: 'stated-feature',
    name: 'Manufacturer-stated feature presence and finishes (synthetic corpus account)',
    kind: 'classification',
    quantity: 'features',
  },
  {
    id: 'lm-79',
    name: 'IES LM-79 — electrical and photometric measurements of solid-state lighting',
    kind: 'measurement',
    quantity: 'photometry',
  },
  {
    id: 'astm-c423',
    name: 'ASTM C423 — sound absorption and noise reduction coefficient (reverberation room)',
    kind: 'measurement',
    quantity: 'acoustic-performance',
  },
  {
    id: 'iso-354',
    name: 'ISO 354 — sound absorption in a reverberation room (weighted absorption, αw)',
    kind: 'measurement',
    quantity: 'acoustic-performance',
  },
  {
    id: 'astm-e1477',
    name: 'ASTM E1477 — luminous reflectance of acoustical materials',
    kind: 'measurement',
    quantity: 'light-reflectance',
  },
  {
    id: 'din-51130',
    name: 'DIN 51130 — ramp test R-classes for floor coverings',
    kind: 'classification',
    quantity: 'slip-resistance',
  },
  {
    id: 'bs-7976',
    name: 'BS 7976 — pendulum tester (pendulum test value, PTV)',
    kind: 'measurement',
    quantity: 'slip-resistance',
  },
  {
    id: 'en-iso-10545-3',
    name: 'EN ISO 10545-3 — water absorption of ceramic tiles',
    kind: 'measurement',
    quantity: 'water-absorption',
  },
  {
    id: 'en-1021',
    name: 'EN 1021-1/-2 — ignitability of upholstered furniture (cigarette and match)',
    kind: 'classification',
    quantity: 'fire-performance',
  },
];

export const CORPUS_EDGES: CorpusEdge[] = [
  {
    fromMethodId: 'din-51130',
    toMethodId: 'bs-7976',
    comparable: false,
    note:
      'different test methods and scales — an R-class from the ramp test is not a pendulum ' +
      'test value, however alike they sound (synthetic corpus account)',
  },
];
