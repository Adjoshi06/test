// Code excerpts — two jurisdictions, two editions each. Section numbers and
// requirements are synthetic but shaped like real code text: tables, editions,
// occupancy conditions. The 2024 IBC and 2026 ADB excerpts tighten their 2018/
// 2019 counterparts, and the ADB floor-lining requirement is the code side of
// the corpus's authority conflict (see doc-firm-standard).

import type { CorpusDocument } from '../types';

export const CODE_DOCUMENTS: CorpusDocument[] = [
  {
    key: 'doc-ibc-2018',
    title: 'International Building Code 2018 — interior finishes excerpt (synthetic fixture)',
    kind: 'code',
    jurisdiction: 'US',
    edition: '2018',
    owner: 'studio-demo',
    passages: [
      {
        key: 'classes',
        locator: '§803.4, Table 803.4 (excerpt)',
        quote:
          'Interior finish classes (flame spread index, ASTM E84): Class A 0–25; Class B ' +
          '26–75; Class C 76–200.',
      },
      {
        key: 'atrium',
        locator: '§404.6',
        quote:
          'Atriums: interior finish shall be Class B where the atrium is sprinklered ' +
          'throughout.',
      },
    ],
    values: [
      {
        passage: 'classes',
        propertyId: 'flame-spread-class-scale',
        raw: 'Class A 0–25; Class B 26–75; Class C 76–200',
        methodId: 'astm-e84',
        authority: 'code',
        verification: 'interpreted',
      },
      {
        passage: 'atrium',
        propertyId: 'interior-finish-requirement',
        raw: 'Class B (atrium, sprinklered)',
        methodId: 'astm-e84',
        authority: 'code',
        verification: 'interpreted',
      },
    ],
  },
  {
    key: 'doc-ibc-2024',
    title: 'International Building Code 2024 — interior finishes excerpt (synthetic fixture)',
    kind: 'code',
    jurisdiction: 'US',
    edition: '2024',
    owner: 'studio-demo',
    passages: [
      {
        key: 'classes',
        locator: '§803.4, Table 803.4 (excerpt)',
        quote:
          'Interior finish classes (flame spread index, ASTM E84): Class A 0–25; Class B ' +
          '26–75; Class C 76–200.',
      },
      {
        key: 'atrium',
        locator: '§404.7',
        quote: 'Atriums: interior finish shall be Class A where the occupant load is 300 or more.',
      },
    ],
    values: [
      {
        passage: 'classes',
        propertyId: 'flame-spread-class-scale',
        raw: 'Class A 0–25; Class B 26–75; Class C 76–200',
        methodId: 'astm-e84',
        authority: 'code',
        verification: 'interpreted',
      },
      {
        passage: 'atrium',
        propertyId: 'interior-finish-requirement',
        raw: 'Class A (atrium, occupant load ≥ 300)',
        methodId: 'astm-e84',
        authority: 'code',
        verification: 'interpreted',
      },
      // The 2024 edition tightens the 2018 atrium requirement from Class B to
      // Class A at high occupant loads — an intra-code edition difference the
      // answer must show, never blend.
    ],
  },
  {
    key: 'doc-uk-adb-2019',
    title:
      'Building Regulations 2010 — Approved Document B (fire safety), 2019 edition — wall and ' +
      'floor linings excerpt (synthetic fixture)',
    kind: 'code',
    jurisdiction: 'UK',
    edition: '2019',
    owner: 'studio-demo',
    passages: [
      {
        key: 'walls',
        locator: 'Vol 2, §8.5',
        quote: 'Wall linings in circulation spaces: European Class B-s3, d2 or better.',
      },
      {
        key: 'floors',
        locator: 'Vol 2, §9.4',
        quote: 'Floor linings in protected circulation routes: Cfl-s2 or better.',
      },
    ],
    values: [
      {
        passage: 'walls',
        propertyId: 'lining-requirement',
        raw: 'B-s3, d2 or better',
        methodId: 'en-13501-1:2018',
        authority: 'code',
        verification: 'interpreted',
      },
      {
        passage: 'floors',
        propertyId: 'floor-fire-requirement',
        raw: 'Cfl-s2 or better',
        methodId: 'en-13501-1:2018',
        authority: 'code',
        verification: 'interpreted',
      },
      // Code side of the authority conflict: the firm standard (doc-firm-
      // standard §3.1) treats Cfl-s3 as acceptable in enclosed wet rooms,
      // which would relax this requirement. Both are recorded; the checker
      // surfaces the conflict instead of blending it.
    ],
  },
  {
    key: 'doc-uk-adb-2026',
    title:
      'Building Regulations 2010 — Approved Document B (fire safety), 2026 edition — wall and ' +
      'floor linings excerpt (synthetic fixture)',
    kind: 'code',
    jurisdiction: 'UK',
    edition: '2026',
    owner: 'studio-demo',
    passages: [
      {
        key: 'walls',
        locator: 'Vol 2, §8.7',
        quote: 'Wall linings in circulation spaces: European Class B-s2, d0 or better.',
      },
      {
        key: 'floors',
        locator: 'Vol 2, §9.6',
        quote: 'Floor linings in protected circulation routes: Cfl-s2 or better.',
      },
    ],
    values: [
      {
        passage: 'walls',
        propertyId: 'lining-requirement',
        raw: 'B-s2, d0 or better',
        methodId: 'en-13501-1:2018',
        authority: 'code',
        verification: 'interpreted',
      },
      {
        passage: 'floors',
        propertyId: 'floor-fire-requirement',
        raw: 'Cfl-s2 or better',
        methodId: 'en-13501-1:2018',
        authority: 'code',
        verification: 'interpreted',
      },
      // The 2026 consolidation tightens wall linings from B-s3, d2 to
      // B-s2, d0 — an edition difference, recorded per edition.
    ],
  },
];
