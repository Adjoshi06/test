// Seating — six products. Manufacturer-style technical specifications with
// page/section locators, stated ranges, finishes — and deliberate gaps
// (Halden and Vind carry no flame-spread value at all; the Halden
// correspondence thread documents why the certificate is missing).

import type { CorpusDocument } from '../types';

export const SEATING_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-halden-spec',
    title: 'Halden task chair — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'seat-height',
        locator: 'p. 4, §2.1',
        quote: 'Seat height adjustable 42–55 cm via gas lift.',
      },
      {
        key: 'upholstery',
        locator: 'p. 5, §3.2',
        quote:
          'Upholstery: black (RAL 9005, matt) or grey (RAL 7035); other colours on request, ' +
          '12-week lead time.',
      },
      {
        key: 'rating',
        locator: 'p. 6, §4.1',
        quote: 'Tested to EN 1335 for dimensional fit; seat load rating 110 kg.',
      },
    ],
    values: [
      {
        passage: 'seat-height',
        propertyId: 'seat-height-adjustable',
        raw: 'Seat height adjustable 42–55 cm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'human-verified',
        verifiedBy: 'studio-lead',
      },
      {
        passage: 'upholstery',
        propertyId: 'finish-color',
        raw: 'black (RAL 9005, matt)',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'rating',
        propertyId: 'load-rating',
        raw: '110 kg',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gap: no flame-spread value anywhere in this document. The
    // fire certificate is pending — see doc-corr-halden-fire.
  },
  {
    key: 'doc-vind-spec',
    title: 'Vind desk chair — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'seat-height',
        locator: 'p. 2, §1',
        quote: 'Gas-lift seat height 40–52 cm.',
      },
      {
        key: 'shell-colours',
        locator: 'p. 3, §2',
        quote: 'Shell colours: signal grey (RAL 7035) or off-white; seat pad charcoal.',
      },
    ],
    values: [
      {
        passage: 'seat-height',
        propertyId: 'seat-height-adjustable',
        raw: 'Gas-lift seat height 40–52 cm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'shell-colours',
        propertyId: 'finish-color',
        raw: 'signal grey (RAL 7035)',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
    // Deliberate gap: no fire data in the manufacturer datasheet at all.
  },
  {
    key: 'doc-mera-spec',
    title: 'Mera conference chair — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'seat-height',
        locator: 'p. 3, §2.4',
        quote: 'Fixed seat height 46 cm; four-leg base, no castors.',
      },
      {
        key: 'fire',
        locator: 'p. 4, §3',
        quote:
          'Flame performance: ASTM E84 Class A (flame spread index 20, smoke developed index ' +
          '30), report 8842-B, tested February 2025.',
      },
      {
        key: 'shell',
        locator: 'p. 4, §3.1',
        quote: 'Polypropylene shell in signal white (RAL 9003) only.',
      },
    ],
    values: [
      {
        passage: 'seat-height',
        propertyId: 'seat-height-adjustable',
        raw: 'Fixed seat height 46 cm',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'ASTM E84 Class A (flame spread index 20, smoke developed index 30)',
        methodId: 'astm-e84',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'shell',
        propertyId: 'finish-color',
        raw: 'signal white (RAL 9003)',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-skala-spec',
    title: 'Skala counter stool — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'heights',
        locator: 'p. 1, §1.2',
        quote: 'Counter height 65 cm; bar height 76 cm variant.',
      },
      {
        key: 'finish',
        locator: 'p. 2, §2',
        quote: 'Solid oak frame; finish oil or black lacquer.',
      },
    ],
    values: [
      {
        passage: 'heights',
        propertyId: 'seat-height-range',
        raw: '65 cm (counter) / 76 cm (bar)',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'finish',
        propertyId: 'finish-color',
        raw: 'black lacquer',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-bram-spec',
    title: 'Bram lounge chair — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'seat-height',
        locator: 'p. 5, §2',
        quote: 'Seat height 40 cm, fixed.',
      },
      {
        key: 'fire',
        locator: 'p. 5, §3',
        quote: 'Fire behaviour: EN 1021-1/-2 (cigarette and match) — passed.',
      },
      {
        key: 'fabric',
        locator: 'p. 7, fabric card',
        quote: 'Fabric groups: Ai (black felt), Bi (oat twill).',
      },
    ],
    values: [
      {
        passage: 'seat-height',
        propertyId: 'seat-height-adjustable',
        raw: 'Seat height 40 cm, fixed',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'EN 1021-1/-2 (cigarette and match) — passed',
        methodId: 'en-1021',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fabric',
        propertyId: 'finish-color',
        raw: 'black felt (fabric group Ai)',
        methodId: 'stated-feature',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-tove-spec',
    title: 'Tove visitor chair — technical specification (synthetic fixture)',
    kind: 'product-doc',
    owner: 'studio-demo',
    passages: [
      {
        key: 'stacking',
        locator: 'p. 2, §1',
        quote: 'Stackable; seat height 45 cm fixed.',
      },
      {
        key: 'fire',
        locator: 'p. 3, §1',
        quote: 'Fire: European class C-s1 (EN 13501-1:2018) — upholstered variants.',
      },
    ],
    values: [
      {
        passage: 'stacking',
        propertyId: 'seat-height-adjustable',
        raw: 'Seat height 45 cm fixed',
        methodId: 'stated-range',
        authority: 'product-doc',
        verification: 'interpreted',
      },
      {
        passage: 'fire',
        propertyId: 'flame-spread',
        raw: 'C-s1',
        methodId: 'en-13501-1:2018',
        authority: 'product-doc',
        verification: 'interpreted',
      },
    ],
  },
];

export const SEATING_PRODUCTS = [
  {
    key: 'halden-task-chair',
    name: 'Halden task chair',
    category: 'seating',
    documentKey: 'doc-halden-spec',
  },
  {
    key: 'vind-desk-chair',
    name: 'Vind desk chair',
    category: 'seating',
    documentKey: 'doc-vind-spec',
  },
  {
    key: 'mera-conference-chair',
    name: 'Mera conference chair',
    category: 'seating',
    documentKey: 'doc-mera-spec',
  },
  {
    key: 'skala-counter-stool',
    name: 'Skala counter stool',
    category: 'seating',
    documentKey: 'doc-skala-spec',
  },
  {
    key: 'bram-lounge-chair',
    name: 'Bram lounge chair',
    category: 'seating',
    documentKey: 'doc-bram-spec',
  },
  {
    key: 'tove-visitor-chair',
    name: 'Tove visitor chair',
    category: 'seating',
    documentKey: 'doc-tove-spec',
  },
] as const;
