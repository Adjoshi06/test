// Ceilings — four products. The comparable-method pair lives here: Fjell
// classifies under EN 13501-1:2018 while Vela's scanned datasheet carries a
// 2007-edition class — successive editions the registry marks comparable.
// Vela also carries no acoustic value; Prism sits under ASTM E84.

import type { CorpusDocument } from '../types';

export const CEILING_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-fjell-spec',
    title: 'Fjell mineral ceiling panel — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 2, §2',
        quote: 'Panel 600×600×15 mm, suspended grid.',
      },
      {
        key: 'fire',
        locator: 'p. 3, §3',
        quote: 'Reaction to fire: B-s1, d0 (EN 13501-1:2018), certificate 1189-CPE.',
      },
      {
        key: 'acoustic',
        locator: 'p. 4, §4',
        quote: 'NRC 0.70 (ASTM C423, type E-400 mounting).',
      },
      {
        key: 'reflectance',
        locator: 'p. 5, §5',
        quote: 'Light reflectance LR 0.85.',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'panel-format',
        raw: '600×600×15 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'B-s1, d0',
        methodId: 'en-13501-1:2018',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'acoustic',
        propertyId: 'acoustic-nrc',
        raw: 'NRC 0.70',
        methodId: 'astm-c423',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'reflectance',
        propertyId: 'light-reflectance',
        raw: 'LR 0.85',
        methodId: 'astm-e1477',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-vela-spec',
    title: 'Vela metal ceiling raft — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 1, §1',
        quote: 'Metal raft 1200×600 mm, 20 mm depth, powder-coat RAL 9010.',
      },
      {
        key: 'fire-scan',
        locator: 'p. 7 (scan, OCR)',
        quote:
          'REACTION TO FIRE: Euroclass A2-s1, d0 per EN 13501-1:2007, report DS/2019-44, ' +
          'sheet 2. [columns 4–6 of the test table are illegible in the scan]',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'panel-format',
        raw: '1200×600 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire-scan',
        propertyId: 'flame-spread',
        raw: 'A2-s1, d0',
        methodId: 'en-13501-1:2007',
        authority: 'product-doc',
        verification: 'machine-read',
      },
      // Machine-read from a scanned page — shown as extracted, never as
      // checked. Comparable with Fjell's 2018-edition class via the registry
      // edge between the two EN editions.
    ],
    // Deliberate gap: no acoustic value — absorption is not measured for the
    // metal raft, so NRC is unknown for this product.
  },
  {
    key: 'doc-hull-spec',
    title: 'Hull acoustic baffle — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 2, §1',
        quote: 'Vertical baffle 1200×300 mm, PET felt 24 mm.',
      },
      {
        key: 'acoustic',
        locator: 'p. 3, §3',
        quote: 'Mid-frequency absorption αw 0.85 (ISO 354); NRC 0.85 (ASTM C423).',
      },
      {
        key: 'fire',
        locator: 'p. 4, §4',
        quote: 'Fire: B-s1, d0 (EN 13501-1:2018).',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'panel-format',
        raw: '1200×300 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'acoustic',
        propertyId: 'acoustic-absorption',
        raw: 'αw 0.85',
        methodId: 'iso-354',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'acoustic',
        propertyId: 'acoustic-nrc',
        raw: 'NRC 0.85',
        methodId: 'astm-c423',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      // αw (ISO 354) and NRC (ASTM C423) have no registry edge — the account
      // refuses to set them side by side even though both are absorption.
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'B-s1, d0',
        methodId: 'en-13501-1:2018',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-prism-spec',
    title: 'Prism suspended ceiling tile — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'format',
        locator: 'p. 2, §1',
        quote: 'Lay-in tile 600×600 mm, 12 mm, white embossed.',
      },
      {
        key: 'fire',
        locator: 'p. 3, §2',
        quote: 'Flame spread ≤ 25, smoke developed ≤ 50 (ASTM E84).',
      },
      {
        key: 'acoustic',
        locator: 'p. 5, §4',
        quote: 'NRC 0.55 (ASTM C423).',
      },
    ],
    values: [
      {
        passage: 'format',
        propertyId: 'panel-format',
        raw: '600×600 mm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'Flame spread ≤ 25, smoke developed ≤ 50',
        methodId: 'astm-e84',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'acoustic',
        propertyId: 'acoustic-nrc',
        raw: 'NRC 0.55',
        methodId: 'astm-c423',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
];

export const CEILING_PRODUCTS = [
  {
    key: 'fjell-mineral-panel',
    name: 'Fjell mineral ceiling panel',
    category: 'ceilings',
    documentKey: 'doc-fjell-spec',
  },
  {
    key: 'vela-metal-raft',
    name: 'Vela metal ceiling raft',
    category: 'ceilings',
    documentKey: 'doc-vela-spec',
  },
  {
    key: 'hull-acoustic-baffle',
    name: 'Hull acoustic baffle',
    category: 'ceilings',
    documentKey: 'doc-hull-spec',
  },
  {
    key: 'prism-suspended-tile',
    name: 'Prism suspended ceiling tile',
    category: 'ceilings',
    documentKey: 'doc-prism-spec',
  },
] as const;
