// Shared synthetic fixtures for the reasoner contract tests. Synthetic and
// clearly marked (locked spec decision: the seeded library is synthetic); real
// documents never enter this repository.

import type { LibraryPassageRecord, LibraryValueRecord } from './types';

const HALDEN_SPEC = {
  documentId: 'doc-halden-spec',
  documentTitle: 'Halden task chair — technical specification (synthetic fixture)',
  locator: 'p. 4, §2.1',
  quote: 'Seat height adjustable 42–55 cm via gas lift.',
  authority: 'product-doc',
  verification: 'human-verified',
  verifiedBy: 'seed-author',
} as const;

export function makeValueRecord(overrides: Partial<LibraryValueRecord> = {}): LibraryValueRecord {
  return {
    id: 'rec-halden-seat-height',
    kind: 'value',
    productId: 'halden-task-chair',
    propertyId: 'seat-height-adjustable',
    raw: 'Seat height adjustable 42–55 cm',
    methodId: 'stated-range',
    ...HALDEN_SPEC,
    ...overrides,
  };
}

export function makePassageRecord(
  overrides: Partial<LibraryPassageRecord> = {}
): LibraryPassageRecord {
  return {
    id: 'rec-brief-finish',
    kind: 'passage',
    documentId: 'doc-brief-12feb',
    documentTitle: 'Studio brief, 12 Feb (synthetic fixture)',
    locator: 'p. 3',
    quote: 'Seating in black, to sit with the studio palette.',
    authority: 'project',
    verification: 'interpreted',
    ...overrides,
  };
}
