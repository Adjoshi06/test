// Synthetic fixtures — the seeded library is synthetic and clearly marked as such
// (locked decision in the spec). Realistic locators exercise the evidence contract
// in miniature; real documents never enter this repository.
//
// Records and answers stay aligned with the fixture corpus's own vocabulary
// (product keys, property ids, locators) — eval/cases.test.ts holds that
// alignment, and the deliberate gaps (no flame-spread for Halden or Vind) are
// the corpus's own.

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
  'rec-halden-finish': {
    id: 'rec-halden-finish',
    propertyId: 'finish-color',
    documentTitle: 'Halden task chair — technical specification (synthetic fixture)',
    locator: 'p. 5, §3.2',
    quote:
      'Upholstery: black (RAL 9005, matt) or grey (RAL 7035); other colours on request, 12-week lead time.',
    verification: 'interpreted',
  },
  'rec-vind-seat-height': {
    id: 'rec-vind-seat-height',
    propertyId: 'seat-height-adjustable',
    documentTitle: 'Vind desk chair — technical specification (synthetic fixture)',
    locator: 'p. 2, §1',
    quote: 'Gas-lift seat height 40–52 cm.',
    verification: 'interpreted',
  },
  'rec-vind-finish': {
    id: 'rec-vind-finish',
    propertyId: 'finish-color',
    documentTitle: 'Vind desk chair — technical specification (synthetic fixture)',
    locator: 'p. 3, §2',
    quote: 'Shell colours: signal grey (RAL 7035) or off-white; seat pad charcoal.',
    verification: 'interpreted',
  },
  'rec-mera-flame': {
    id: 'rec-mera-flame',
    propertyId: 'flame-spread',
    documentTitle: 'Mera conference chair — technical specification (synthetic fixture)',
    locator: 'p. 4, §3',
    quote:
      'Flame performance: ASTM E84 Class A (flame spread index 20, smoke developed index 30), report 8842-B, tested February 2025.',
    verification: 'interpreted',
  },
  'rec-lume-photometry': {
    id: 'rec-lume-photometry',
    propertyId: 'color-temperature',
    documentTitle: 'Lume pendant light — technical specification (synthetic fixture)',
    locator: 'p. 3, §2',
    quote: 'Light source: LED module, 2700 K, CRI 92, 980 lm delivered.',
    verification: 'interpreted',
  },
  'rec-hull-nrc': {
    id: 'rec-hull-nrc',
    propertyId: 'acoustic-nrc',
    documentTitle: 'Hull acoustic baffle — technical specification (synthetic fixture)',
    locator: 'p. 2, §1',
    quote: 'Noise reduction coefficient NRC 0.80 (Type J mounting).',
    verification: 'interpreted',
  },
  'rec-vela-format': {
    id: 'rec-vela-format',
    propertyId: 'panel-format',
    documentTitle: 'Vela metal ceiling raft — technical specification (synthetic fixture)',
    locator: 'p. 1, §1',
    quote: 'Suspended raft modules 1200 × 600 mm.',
    verification: 'machine-read',
  },
  'rec-tove-finish': {
    id: 'rec-tove-finish',
    propertyId: 'finish-color',
    documentTitle: 'Tove visitor chair — technical specification (synthetic fixture)',
    locator: 'p. 2, §2',
    quote: 'Shell colours: black or off-white.',
    verification: 'machine-read',
  },
};

// One scripted answer per case question — exact-question lookup (the engine's
// whole contract). The clarify drafts name their readings and the refusals
// carry their reasons: what the graders demand of a real reasoner, the stub
// must meet too.
export const SCRIPTED_ANSWERS: Readonly<Record<string, AnswerDraft>> = {
  'show me task chairs': {
    outcome: 'answer',
    candidates: [
      { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
      { productId: 'vind-desk-chair', claims: [{ recordId: 'rec-vind-seat-height' }] },
    ],
  },
  'we need a pendant over the conference table': {
    outcome: 'answer',
    candidates: [{ productId: 'lume-pendant', claims: [{ recordId: 'rec-lume-photometry' }] }],
  },
  'what can we hang from the exposed soffit to tame the echo?': {
    outcome: 'answer',
    candidates: [
      { productId: 'hull-acoustic-baffle', claims: [{ recordId: 'rec-hull-nrc' }] },
      { productId: 'vela-metal-raft', claims: [{ recordId: 'rec-vela-format' }] },
    ],
  },
  'show me visitor chairs for the reception': {
    outcome: 'answer',
    candidates: [{ productId: 'tove-visitor-chair', claims: [{ recordId: 'rec-tove-finish' }] }],
  },
  "what's the fire rating on the Halden task chair?": {
    outcome: 'answer',
    // No claim: the corpus deliberately holds no flame-spread value for Halden
    // (the fire certificate is pending — the correspondence thread records it).
    candidates: [{ productId: 'halden-task-chair', claims: [] }],
    unknowns: [
      {
        propertyId: 'flame-spread',
        reason:
          'No fire classification for Halden exists in the library — a full search found none. The fire certificate is pending.',
      },
    ],
  },
  'what fire class does the Mera conference chair have?': {
    outcome: 'answer',
    candidates: [{ productId: 'mera-conference-chair', claims: [{ recordId: 'rec-mera-flame' }] }],
  },
  'does the Vind desk chair come in black?': {
    outcome: 'answer',
    // The recorded value answers the question honestly: grey or off-white —
    // not black. A found value, not an unknown.
    candidates: [{ productId: 'vind-desk-chair', claims: [{ recordId: 'rec-vind-finish' }] }],
  },
  "we need ergonomic chairs for the developers' desks": {
    // Lay term: “ergonomic” reads as adjustable seat height + lumbar support.
    // The translation is the interpretation layer's; the claims stay references.
    outcome: 'answer',
    candidates: [
      { productId: 'halden-task-chair', claims: [{ recordId: 'rec-halden-seat-height' }] },
      { productId: 'vind-desk-chair', claims: [{ recordId: 'rec-vind-seat-height' }] },
    ],
  },
  'we want warm light over the studio tables': {
    // Lay term: “warm” reads as a warm color temperature (~2700 K).
    outcome: 'answer',
    candidates: [{ productId: 'lume-pendant', claims: [{ recordId: 'rec-lume-photometry' }] }],
  },
  'which of the desk and conference chairs meet flame-spread Class A?': {
    // Mera carries the only flame-spread value; the other two chairs are
    // candidates the code question cannot compute — reported as unknowns, one
    // not-found and one search-failed, never blended.
    outcome: 'answer',
    candidates: [{ productId: 'mera-conference-chair', claims: [{ recordId: 'rec-mera-flame' }] }],
    unknowns: [
      {
        propertyId: 'flame-spread',
        reason:
          'Halden: no fire classification in the library — the certificate is pending (not found).',
        status: 'not-found',
      },
      {
        propertyId: 'flame-spread',
        reason:
          'Vind: the flame-spread search did not complete — the index was unavailable. A retry re-runs it (search failed).',
        status: 'search-failed',
      },
    ],
  },
  'does the Mera conference chair pass the IBC 2024 atrium finish requirement?': {
    outcome: 'answer',
    candidates: [{ productId: 'mera-conference-chair', claims: [{ recordId: 'rec-mera-flame' }] }],
  },
  'we need soundproofing for the United conference room': {
    // “Soundproof” names three different needs rated by different methods —
    // a question back, naming the readings.
    outcome: 'clarify',
    readings: [
      'speech privacy between rooms (sound isolation, dB/description)',
      'reverberation control inside the room (absorption class)',
      'impact noise from adjacent floors (impact insulation)',
    ],
  },
  'lighting for the United conference room': {
    // Task lighting over the table, ambient fill, or presentation wall wash —
    // a question back, naming the readings.
    outcome: 'clarify',
    readings: [
      'task lighting over the conference table',
      'ambient fill for the whole room',
      'wall wash for the presentation wall',
    ],
  },
  'which chair is the best?': {
    // The library holds specifications, not judgments — a refusal with its reason.
    outcome: 'refuse',
    refusalReason:
      'The library records measured values, not verdicts — no recorded ranking can support “best”. Name the requirements to meet.',
    unknowns: [
      {
        propertyId: '*',
        reason:
          'No recorded ranking exists — the library records values, not verdicts. Name the requirements to meet.',
      },
    ],
  },
  'which pendant lights are under $300?': {
    // Pricing exists nowhere in the library — a refusal with its reason.
    outcome: 'refuse',
    refusalReason:
      'The library records specifications, not commercial terms — no pricing exists to compare.',
    unknowns: [
      {
        propertyId: 'price',
        reason:
          'The library records specifications, not commercial terms — no pricing exists to compare.',
      },
    ],
  },
};
