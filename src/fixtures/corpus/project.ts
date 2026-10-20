// Project material — the two briefs and the firm's materials standard. The
// brief quotes are the corpus's requirement sources; the firm standard holds
// the project side of the authority conflict and a firm-only added
// requirement (upholstery ignitability).

import type { CorpusDocument } from '../types';

export const PROJECT_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-brief-12feb',
    title: 'Studio brief, 12 Feb (synthetic fixture)',
    kind: 'project',
    owner: 'studio-demo',
    passages: [
      {
        key: 'finish',
        locator: 'p. 3',
        quote: 'Seating in black, to sit with the studio palette.',
      },
      {
        key: 'workstations',
        locator: 'p. 4',
        quote: 'Workstations: 24 ergonomic task seats, height-adjustable.',
      },
    ],
    values: [
      {
        passage: 'finish',
        propertyId: 'seating-finish-requirement',
        raw: 'Black',
        methodId: 'stated-feature',
        authority: 'project',
        verification: 'interpreted',
      },
      {
        passage: 'workstations',
        propertyId: 'seating-quantity',
        raw: '24',
        methodId: 'stated-range',
        authority: 'project',
        verification: 'interpreted',
      },
      // "Ergonomic" is left untranslated on purpose — translating lay terms
      // is the reasoner's job, marked as its own inference.
    ],
  },
  {
    key: 'doc-brief-united-room',
    title: 'Meridian Hotel — United conference room brief (synthetic fixture)',
    kind: 'project',
    owner: 'studio-demo',
    passages: [
      {
        key: 'lighting',
        locator: 'p. 2, §2',
        quote:
          'Lighting for the United conference room: pendant-mounted over the table, 3000 K, ' +
          'dimmable to 10 % for presentations.',
      },
      {
        key: 'ceilings',
        locator: 'p. 3, §3',
        quote:
          'Ceilings: exposed soffit with suspended rafts; acoustic treatment where measured ' +
          'NRC ≥ 0.70.',
      },
    ],
    values: [
      {
        passage: 'lighting',
        propertyId: 'mounting-requirement',
        raw: 'pendant-mounted',
        methodId: 'stated-feature',
        authority: 'project',
        verification: 'interpreted',
      },
      {
        passage: 'lighting',
        propertyId: 'color-temperature-requirement',
        raw: '3000 K',
        methodId: 'lm-79',
        authority: 'project',
        verification: 'interpreted',
      },
      {
        passage: 'lighting',
        propertyId: 'dimming-requirement',
        raw: 'dimmable to 10 %',
        methodId: 'stated-feature',
        authority: 'project',
        verification: 'interpreted',
      },
      {
        passage: 'ceilings',
        propertyId: 'acoustic-requirement',
        raw: 'NRC ≥ 0.70',
        methodId: 'astm-c423',
        authority: 'project',
        verification: 'interpreted',
      },
      // The acoustic requirement reads on the Fjell (NRC 0.70) and Hull (NRC
      // 0.85) values under the same method; the Vela raft has no NRC value at
      // all, so compliance there is unknown — not failed.
    ],
  },
  {
    key: 'doc-firm-standard',
    title: 'Studio materials standard — finishes and linings (synthetic fixture)',
    kind: 'project',
    owner: 'studio-demo',
    passages: [
      {
        key: 'wet-rooms',
        locator: '§3.1 (finishes)',
        quote:
          'Wet-room floor finishes: Cfl-s3 minimum is acceptable where the room is fully ' +
          'enclosed and served by a sprinkler head.',
      },
      {
        key: 'upholstery',
        locator: '§5.2 (upholstery)',
        quote:
          'All upholstered seating in client-facing areas: ignitability to EN 1021-1/-2 ' +
          '(cigarette and match) is required in addition to any code requirement.',
      },
    ],
    values: [
      {
        passage: 'wet-rooms',
        propertyId: 'floor-fire-requirement',
        raw: 'Cfl-s3 minimum acceptable (enclosed wet rooms)',
        methodId: 'en-13501-1:2018',
        authority: 'project',
        verification: 'interpreted',
      },
      {
        passage: 'upholstery',
        propertyId: 'upholstery-fire-requirement',
        raw: 'EN 1021-1/-2 pass',
        methodId: 'en-1021',
        authority: 'project',
        verification: 'interpreted',
      },
      // §3.1 conflicts with Approved Document B 2019 §9.4 (Cfl-s2 or better):
      // firm knowledge may add requirements, never relax a code — the checker
      // shows both, it does not average them. §5.2 is the additive case.
    ],
  },
];
