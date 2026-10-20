// Tile — four products. Water absorption under EN ISO 10545-3; slip under two
// deliberately non-comparable methods (DIN 51130 R-classes vs BS 7976 PTV);
// fire under both EN 13501-1 and ASTM E84. Verre, Kaolin and Terra carry
// deliberate gaps.

import type { CorpusDocument } from '../types';

export const TILE_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-verre-spec',
    title: 'Verre ceramic field tile — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'absorption',
        locator: 'p. 2, §2',
        quote: 'Water absorption ≤ 10 % (group BIII, pressed, per EN ISO 10545-3).',
      },
      {
        key: 'formats',
        locator: 'p. 3, §3',
        quote: 'Format table: 100×100, 100×300, 200×200 mm; thickness 8 mm.',
      },
    ],
    values: [
      {
        passage: 'absorption',
        propertyId: 'water-absorption',
        raw: '≤ 10 % (group BIII)',
        methodId: 'en-iso-10545-3',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'formats',
        propertyId: 'tile-format',
        raw: '100×100 / 100×300 / 200×200 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gap: no slip-resistance value — the Verre is sold as a wall
    // tile and the datasheet is silent on floor use.
  },
  {
    key: 'doc-basalt-spec',
    title: 'Basalt porcelain tile — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'absorption',
        locator: 'p. 2, §2',
        quote: 'Water absorption ≤ 0.5 % (group BIa, per EN ISO 10545-3).',
      },
      {
        key: 'slip',
        locator: 'p. 3, §3',
        quote: 'Slip resistance: R10 (DIN 51130 ramp test).',
      },
      {
        key: 'fire-en',
        locator: 'p. 4, §4',
        quote: 'Reaction to fire: A1-s1, d0 (EN 13501-1:2018), notified-body report 0499/21.',
      },
      {
        key: 'fire-us',
        locator: 'p. 9, US data sheet appendix',
        quote: 'Surface burning characteristics: Class A per ASTM E84 (FSI 25, SDI 10).',
      },
    ],
    values: [
      {
        passage: 'absorption',
        propertyId: 'water-absorption',
        raw: '≤ 0.5 % (group BIa)',
        methodId: 'en-iso-10545-3',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'slip',
        propertyId: 'slip-resistance',
        raw: 'R10',
        methodId: 'din-51130',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire-en',
        propertyId: 'flame-spread',
        raw: 'A1-s1, d0',
        methodId: 'en-13501-1:2018',
        authority: 'product-doc',
        verification: 'human-verified',
        verifiedBy: 'studio-lead',
      },
      {
        passage: 'fire-us',
        propertyId: 'flame-spread',
        raw: 'Class A per ASTM E84 (FSI 25, SDI 10)',
        methodId: 'astm-e84',
        authority: 'product-doc',
        verification: 'machine-read',
      },
      // Two flame-spread values under methods the registry knows are NOT
      // comparable — the checker must refuse to set them side by side.
    ],
  },
  {
    key: 'doc-kaolin-spec',
    title: 'Kaolin glass mosaic — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 2, §1',
        quote: 'Glass mosaic 25×25 mm on 300×300 sheets, 4 mm thick.',
      },
      {
        key: 'absorption',
        locator: 'p. 3, §2',
        quote: 'Water absorption ≤ 0.1 % (impervious, group AI, per EN ISO 10545-3).',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'tile-format',
        raw: '25×25 mm on 300×300 sheets',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'absorption',
        propertyId: 'water-absorption',
        raw: '≤ 0.1 % (group AI)',
        methodId: 'en-iso-10545-3',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gap: no slip-resistance value — would resolve with the
    // manufacturer's floor-use declaration.
  },
  {
    key: 'doc-terra-spec',
    title: 'Terra terracotta tile — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 2, §1',
        quote: 'Extruded terracotta, 150×150×15 mm; sealed finish recommended for wet areas.',
      },
      {
        key: 'slip',
        locator: 'p. 3, §2',
        quote:
          'R9 (DIN 51130) as supplied; PTV 36+ wet (BS 7976 pendulum, 4S rubber slider) after sealing.',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'tile-format',
        raw: '150×150×15 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'slip',
        propertyId: 'slip-resistance',
        raw: 'R9 (as supplied)',
        methodId: 'din-51130',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'slip',
        propertyId: 'slip-resistance-pendulum',
        raw: 'PTV 36+ wet (after sealing)',
        methodId: 'bs-7976',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gaps: no flame-spread value (sealant-dependent — would
    // resolve with a sealed-system test report) and no frost-resistance.
  },
];

export const TILE_PRODUCTS = [
  {
    key: 'verre-ceramic-tile',
    name: 'Verre ceramic field tile',
    category: 'tile',
    documentKey: 'doc-verre-spec',
  },
  {
    key: 'basalt-porcelain-tile',
    name: 'Basalt porcelain tile',
    category: 'tile',
    documentKey: 'doc-basalt-spec',
  },
  {
    key: 'kaolin-glass-mosaic',
    name: 'Kaolin glass mosaic',
    category: 'tile',
    documentKey: 'doc-kaolin-spec',
  },
  {
    key: 'terra-terracotta-tile',
    name: 'Terra terracotta tile',
    category: 'tile',
    documentKey: 'doc-terra-spec',
  },
] as const;
