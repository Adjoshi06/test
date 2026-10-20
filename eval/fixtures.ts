// Synthetic fixtures — the seeded library is synthetic and clearly marked as such
// (locked decision in the spec). Realistic locators exercise the evidence contract
// in miniature; real documents never enter this repository.

import type { AnswerDraft, ScriptedRecord } from './schema';

export const SCRIPTED_LIBRARY: Readonly<Record<string, ScriptedRecord>> = {
  'rec-halden-seat-height': {
    id: 'rec-halden-seat-height',
    propertyId: 'seat-height-adjustable',
    documentTitle: 'Halden task chair — technical specification (synthetic fixture)',
    locator: 'p. 4, §2.1',
    quote: 'Seat height adjustable 42–55 cm via gas lift.',
    verification: 'human-verified',
    verifiedBy: 'seed-author',
  },
};

export const SCRIPTED_ANSWERS: Readonly<Record<string, AnswerDraft>> = {
  'show me task chairs': {
    outcome: 'answer',
    candidates: [
      {
        productId: 'halden-task-chair',
        claims: [{ recordId: 'rec-halden-seat-height' }],
      },
    ],
  },
};
