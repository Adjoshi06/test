// The answer UI's scripted demo — the same fixtures discipline as the reasoner's
// test fixtures (locked spec decision: everything synthetic and clearly marked).
// The demo page never hands a draft to the components: the scripted reasoner
// proposes, the real assertion checker (assembleAnswer) assembles, and the UI
// renders only the CheckedAnswer that comes back — the boundary invariant,
// exercised end to end in the browser.
//
// Editing the interpretation re-runs this loop with the edited reading as the
// question. The scripted engine answers what it holds and refuses the rest —
// ask rather than guess, dogfooded.

import { assembleAnswer } from '@/lib/checker/assemble';
import type { CheckedAnswer, ComparisonOutcome } from '@/lib/checker/types';
import type { ComparabilityDecision } from '@/lib/registry/comparability';
import { FakeReasoner, type ScriptedCase } from '@/lib/reasoner/fake-engine';
import type { AnswerDraft, LibraryRecord, LibraryValueRecord } from '@/lib/reasoner/types';
import { refusalDraft } from '@/lib/reasoner/types';

// --- The scripted corpus ------------------------------------------------------

const HALDEN_SPEC = {
  documentId: 'doc-halden-spec',
  documentTitle: 'Halden task chair — technical specification (synthetic fixture)',
} as const;

const VIND_SPEC = {
  documentId: 'doc-vind-spec',
  documentTitle: 'Vind desk chair — technical specification (synthetic fixture)',
} as const;

function value(record: Omit<LibraryValueRecord, 'kind'>): LibraryRecord {
  return { kind: 'value', ...record };
}

const DEMO_RECORDS: readonly LibraryRecord[] = [
  value({
    id: 'rec-halden-seat-height',
    productId: 'halden-task-chair',
    propertyId: 'seat-height-adjustable',
    raw: 'Seat height adjustable 42–55 cm',
    methodId: 'stated-range',
    ...HALDEN_SPEC,
    locator: 'p. 4, §2.1',
    quote: 'Seat height adjustable 42–55 cm via gas lift.',
    authority: 'product-doc',
    verification: 'human-verified',
    verifiedBy: 'M. Okafor',
  }),
  value({
    id: 'rec-halden-lumbar',
    productId: 'halden-task-chair',
    propertyId: 'lumbar-support',
    raw: 'Integrated lumbar support, height-adjustable',
    methodId: 'stated-feature',
    ...HALDEN_SPEC,
    locator: 'p. 5, §2.6',
    quote: 'Backrest carries an integrated lumbar support, height-adjustable.',
    authority: 'product-doc',
    verification: 'machine-read',
  }),
  value({
    id: 'rec-halden-finish',
    productId: 'halden-task-chair',
    propertyId: 'finish-color',
    raw: 'Black',
    methodId: 'ral',
    ...HALDEN_SPEC,
    locator: 'p. 6, §3.0',
    quote: 'Shell and seat shell in Black.',
    authority: 'product-doc',
    verification: 'interpreted',
  }),
  value({
    id: 'rec-mera-finish',
    productId: 'mera-conference-chair',
    propertyId: 'finish-color',
    raw: 'White',
    methodId: 'ral',
    documentId: 'doc-mera-sheet',
    documentTitle: 'Mera conference chair — product sheet (synthetic fixture)',
    locator: 'p. 2, §1.4',
    quote: 'Standard finish: White.',
    authority: 'product-doc',
    verification: 'machine-read',
  }),
  value({
    id: 'rec-mera-finish-correction',
    productId: 'mera-conference-chair',
    propertyId: 'finish-color',
    raw: 'Off-white (RAL 9010)',
    methodId: 'ral',
    documentId: 'doc-mera-rep-msg',
    documentTitle: 'Correspondence — Mera studio rep, 14 Mar (synthetic fixture)',
    locator: 'msg 14 Mar, author studio rep',
    quote: 'The White option was discontinued in February; current stock is Off-white (RAL 9010).',
    authority: 'correspondence',
    verification: 'interpreted',
  }),
  value({
    id: 'rec-mera-flame',
    productId: 'mera-conference-chair',
    propertyId: 'flame-spread-class',
    raw: 'Class B-s2, d0',
    methodId: 'en-13501-1',
    documentId: 'doc-mera-fire-cert',
    documentTitle: 'Correspondence — Mera fire certificate attached, 2 Apr (synthetic fixture)',
    locator: 'msg 2 Apr, author studio rep',
    quote: 'Certificate EN 13501-1: class B-s2, d0.',
    authority: 'correspondence',
    verification: 'human-verified',
    verifiedBy: 'M. Okafor',
  }),
  value({
    id: 'rec-vind-seat-height',
    productId: 'vind-desk-chair',
    propertyId: 'seat-height-adjustable',
    raw: 'Seat height adjustable 44–54 cm',
    methodId: 'stated-range',
    ...VIND_SPEC,
    locator: 'p. 3, §2.2',
    quote: 'Gas-lift seat height 44–54 cm.',
    authority: 'product-doc',
    verification: 'human-verified',
    verifiedBy: 'M. Okafor',
  }),
  value({
    id: 'rec-vind-finish',
    productId: 'vind-desk-chair',
    propertyId: 'finish-color',
    raw: 'Grey',
    methodId: 'ral',
    ...VIND_SPEC,
    locator: 'p. 4, §3.1',
    quote: 'Available finishes: Grey.',
    authority: 'product-doc',
    verification: 'machine-read',
  }),
];

const RECORDS_BY_ID = new Map<string, LibraryRecord>(DEMO_RECORDS.map((r) => [r.id, r]));

// --- The methods account, as the demo loop sees it ----------------------------

const DEMO_METHOD_EDGE: ComparabilityDecision = {
  verdict: 'comparable',
  basis: 'explicit-edge',
  reason:
    'The methods account links en-13501-1 to astm-e84 (synthetic demo edge): classes may be set side by side, never equated.',
};

function demoCompare(a: string, b: string): ComparisonOutcome {
  if (a === b) {
    return {
      verdict: 'comparable',
      basis: 'same-method',
      reason: `Both values sit under the same method (${a}) — nothing to bridge.`,
    };
  }
  const [first, second] = a < b ? [a, b] : [b, a];
  if (first === 'astm-e84' && second === 'en-13501-1') return DEMO_METHOD_EDGE;
  return { kind: 'unregistered', methodIds: [a, b] };
}

// --- The script ---------------------------------------------------------------

const ANSWER_QUESTION =
  'Which task chairs work for the studio — ergonomic, black, and meeting code on flame spread?';

const CLARIFY_QUESTION = 'We need soundproofing for the United conference room.';

const REFUSAL_QUESTION = 'Which chair is the best?';

const answerDraft: AnswerDraft = {
  outcome: 'answer',
  interpretation: [
    {
      statement:
        'Task chairs for the studio — seat height adjustable, lumbar support, black finish, and code-compliant on flame spread.',
      translations: [
        { layTerm: 'ergonomic', explicitTerm: 'adjustable seat height + lumbar support' },
      ],
      inferredNeeds: ['seated desk work'],
    },
  ],
  requirements: [
    {
      propertyId: 'seat-height-adjustable',
      statement: 'Seat height adjustable',
      source: { kind: 'user' },
      check: { kind: 'present' },
    },
    {
      propertyId: 'lumbar-support',
      statement: 'Lumbar support',
      source: { kind: 'inference', basis: 'from “ergonomic”' },
      check: { kind: 'present' },
    },
    {
      propertyId: 'finish-color',
      statement: 'Available in black',
      source: { kind: 'project', ref: 'Studio brief, 12 Feb, p. 3' },
      check: { kind: 'raw-equals', raw: 'Black', methodId: 'ral' },
    },
    {
      propertyId: 'flame-spread-class',
      statement: 'Interior finish flame-spread Class A',
      source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
      check: { kind: 'raw-equals', raw: 'Class A', methodId: 'astm-e84' },
    },
  ],
  candidates: [
    {
      productId: 'halden-task-chair',
      claims: [
        { recordId: 'rec-halden-seat-height' },
        { recordId: 'rec-halden-lumbar' },
        { recordId: 'rec-halden-finish' },
      ],
    },
    {
      productId: 'mera-conference-chair',
      claims: [
        { recordId: 'rec-mera-finish' },
        { recordId: 'rec-mera-finish-correction' },
        { recordId: 'rec-mera-flame' },
      ],
    },
    {
      productId: 'vind-desk-chair',
      claims: [{ recordId: 'rec-vind-seat-height' }, { recordId: 'rec-vind-finish' }],
    },
  ],
  commentary: [
    'Halden fits the brief best on what the library holds. Two candidates lack a flame-spread entry, so code compliance is unknown — not met, and not failed.',
    'Mera’s own sheet and its rep’s correction disagree on the finish — the disagreement is shown, not blended.',
  ],
  unknowns: [
    {
      propertyId: 'flame-spread-class',
      status: 'not-found',
      reason: 'No fire classification for Halden exists in the library — a full search found none.',
      wouldResolve: 'The manufacturer’s fire certificate (an EN 13501-1 or ASTM E84 class).',
    },
    {
      propertyId: 'flame-spread-class',
      status: 'search-failed',
      reason: 'The flame-spread search for Vind did not complete — the index was unavailable.',
      wouldResolve: 'A retry — the search re-runs when the index answers.',
    },
  ],
};

const clarifyDraft: AnswerDraft = {
  outcome: 'clarify',
  interpretation: [
    {
      statement:
        'A question about sound for the United conference room — “soundproof” names more than one need.',
      translations: [],
      inferredNeeds: [],
    },
  ],
  requirements: [],
  candidates: [],
  commentary: [],
  unknowns: [],
  questionBack: {
    ambiguity:
      '“Soundproof” can name three different needs — the library treats them as different products, rated by different methods.',
    readings: [
      {
        reading: 'Absorption inside the room — acoustic panels',
        whatItWouldChange:
          'Candidates become absorbers rated by NRC; the comparison is about echo in the room, not transmission.',
      },
      {
        reading: 'Blocking sound leaving the room — a partition',
        whatItWouldChange:
          'Candidates become partition systems rated by STC — a different product family and a different method.',
      },
      {
        reading: 'Impact noise from the suite above — a floor assembly',
        whatItWouldChange:
          'Candidates become floor assemblies rated by IIC — again a different method, and a different answer.',
      },
    ],
  },
};

const refusalDraftForBest = refusalDraft(
  REFUSAL_QUESTION,
  {
    status: 'not-found',
    reason:
      'The library holds specifications, not judgments — “best” is a fit assessment the sources cannot support. Name the requirements to meet, and the answer computes each chair against them.',
  },
  [
    {
      propertyId: '*',
      status: 'not-found',
      reason: 'No recorded ranking exists — the library records values, not verdicts.',
      wouldResolve:
        'Name the requirements (finish, code, budget); the answer then computes meet, fail, or unknown per chair.',
    },
  ]
);

const SCRIPT: readonly ScriptedCase[] = [
  { question: ANSWER_QUESTION, draft: answerDraft },
  { question: CLARIFY_QUESTION, draft: clarifyDraft },
  { question: REFUSAL_QUESTION, draft: refusalDraftForBest },
];

// --- The loop -----------------------------------------------------------------

const demoReasoner = new FakeReasoner(SCRIPT);

/**
 * One pass of the loop for the demo page: the scripted reasoner proposes, the
 * assertion checker disposes. The demo's records map stands in for the
 * viewer-scoped library; visibility lands with the sign-in PR.
 */
export async function runDemoLoop(question: string): Promise<CheckedAnswer> {
  const draft = await demoReasoner.answer({ question });
  return assembleAnswer({ draft, records: RECORDS_BY_ID, compare: demoCompare });
}

export const DEMO_QUESTIONS = {
  answer: ANSWER_QUESTION,
  clarify: CLARIFY_QUESTION,
  refusal: REFUSAL_QUESTION,
} as const;

/**
 * All three demo outcomes through the real checker — the fixtures the answer-UI
 * component tests assert against, so tests see exactly what checker output
 * renders. Async: the scripted reasoner's answer() is async.
 */
export async function buildDemoFixtures(): Promise<{
  answer: CheckedAnswer;
  clarify: CheckedAnswer;
  refusal: CheckedAnswer;
}> {
  return {
    answer: await runDemoLoop(DEMO_QUESTIONS.answer),
    clarify: await runDemoLoop(DEMO_QUESTIONS.clarify),
    refusal: await runDemoLoop(DEMO_QUESTIONS.refusal),
  };
}
