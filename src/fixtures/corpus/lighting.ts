// Lighting — four products. Photometric values sit under LM-79; stated
// dimensions and features under the corpus's stated-range/stated-feature
// methods. Aery carries no photometric report — a deliberate gap.

import type { CorpusDocument } from '../types';

export const LIGHTING_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-lume-spec',
    title: 'Lume pendant light — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'dimensions',
        locator: 'p. 2, §1',
        quote: 'Dimension table: shade Ø 380 mm; suspension cable 2000 mm max; canopy Ø 100 mm.',
      },
      {
        key: 'photometry',
        locator: 'p. 3, §2',
        quote: 'Light source: LED module, 2700 K, CRI 92, 980 lm delivered.',
      },
      {
        key: 'dimming',
        locator: 'p. 3, §2.1',
        quote: 'Dimmable 1–10 V and DALI.',
      },
    ],
    values: [
      {
        passage: 'dimensions',
        propertyId: 'fixture-diameter',
        raw: 'shade Ø 380 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'luminous-flux',
        raw: '980 lm delivered',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'color-temperature',
        raw: '2700 K',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'color-rendering-index',
        raw: 'CRI 92',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'dimming',
        propertyId: 'dimmable',
        raw: '1–10 V and DALI',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-kestrel-spec',
    title: 'Kestrel linear suspended luminaire — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'modules',
        locator: 'p. 2, §1',
        quote: 'Continuous-run linear luminaire, 1200 mm and 1500 mm modules.',
      },
      {
        key: 'photometry',
        locator: 'p. 4, §3',
        quote: 'Photometry per IES LM-79: 3200 lm at 3000 K, CRI 90; UGR < 19.',
      },
    ],
    values: [
      {
        passage: 'modules',
        propertyId: 'fixture-length',
        raw: '1200 mm / 1500 mm modules',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'luminous-flux',
        raw: '3200 lm',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'color-rendering-index',
        raw: 'CRI 90',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'machine-read',
      },
    ],
  },
  {
    key: 'doc-noct-spec',
    title: 'Noct recessed downlight — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'trims',
        locator: 'p. 1, §1.1',
        quote:
          'Trim table: round flanged, round flangeless, square; reflector angles 24° / 36° / 55°.',
      },
      {
        key: 'photometry',
        locator: 'p. 2, §2',
        quote: 'Delivered flux 1150 lm, 2700 K or 3000 K switchable, CRI 93.',
      },
      {
        key: 'fire-cover',
        locator: 'p. 5, §6',
        quote:
          'Fire-rated cover recommended where installed in fire-rated ceilings; see accessory FC-90.',
      },
    ],
    values: [
      {
        passage: 'trims',
        propertyId: 'trim-options',
        raw: 'round flanged / round flangeless / square',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'photometry',
        propertyId: 'luminous-flux',
        raw: '1150 lm',
        methodId: 'lm-79',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // The fire-cover passage carries no value: it names an accessory, not a
    // rating. Deliberate — a passage without a value is a valid shape.
  },
  {
    key: 'doc-aery-spec',
    title: 'Aery floor lamp — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'dimensions',
        locator: 'p. 1, §1',
        quote: 'Ø 450 mm shade, 1400 mm overall height, 2500 mm cable.',
      },
      {
        key: 'lamp',
        locator: 'p. 2, §2',
        quote: 'E27 socket, 2700 K lamp included.',
      },
    ],
    values: [
      {
        passage: 'dimensions',
        propertyId: 'fixture-diameter',
        raw: 'Ø 450 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'lamp',
        propertyId: 'color-temperature',
        raw: '2700 K lamp included',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gap: no LM-79 photometric report exists for the Aery —
    // luminous flux and CRI are unknown for this product.
  },
];

export const LIGHTING_PRODUCTS = [
  {
    key: 'lume-pendant',
    name: 'Lume pendant light',
    category: 'lighting',
    documentKey: 'doc-lume-spec',
  },
  {
    key: 'kestrel-linear',
    name: 'Kestrel linear suspended luminaire',
    category: 'lighting',
    documentKey: 'doc-kestrel-spec',
  },
  {
    key: 'noct-downlight',
    name: 'Noct recessed downlight',
    category: 'lighting',
    documentKey: 'doc-noct-spec',
  },
  {
    key: 'aery-floor-lamp',
    name: 'Aery floor lamp',
    category: 'lighting',
    documentKey: 'doc-aery-spec',
  },
] as const;
