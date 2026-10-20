// The reasoner's prompt carries the office rules. The rules are exported data,
// so contract tests can assert every rule is present on every prompt the
// adapter builds — a rule that drops out of the prompt fails CI, not an answer
// (spec: the prompt carries the office rules).
//
// Two parts: the system prompt (role + rules) and the user prompt (the
// question, the search results as the only referencable record ids, and the
// required JSON shape).

import type { LibraryRecord } from './types';

/** The office rules — the model never asserts; it proposes references and labeled judgment. */
export const OFFICE_RULES: readonly string[] = [
  'Translate lay terms explicitly — render terms like "soundproof" or "ergonomic" as measurable properties, and mark every translation and inferred need as the assistant\'s own, editable.',
  'Ask rather than guess — if the question is ambiguous, return outcome "clarify" naming each reading and what choosing it would change; do not answer until a reading is chosen.',
  'Propose unknown rather than fill — when the library holds no support for a value, return an unknown with why and what would resolve it; never supply a value from your own knowledge.',
  'Never state values, quotes, or product names on your own authority — every claim must be a bare reference to a record id from the search results below, and nothing else.',
  'Stop rather than guess on missing support — when the sources cannot support an answer, return outcome "refuse" with its reason.',
];

/** What a candidate claim may carry: a record id. The checker resolves it; the model never restates it. */
export const DRAFT_JSON_SHAPE = `{
  "outcome": "answer" | "clarify" | "refuse",
  "interpretation": [{ "statement": string, "translations": [{ "layTerm": string, "explicitTerm": string }], "inferredNeeds": string[] }],
  "requirements": [{ "propertyId": string, "statement": string, "source": { "kind": "user" } | { "kind": "project", "ref": string } | { "kind": "firm", "ref": string } | { "kind": "code", "ref": string } | { "kind": "inference", "basis": string } }],
  "candidates": [{ "productId": string, "claims": [{ "recordId": string }] }],
  "commentary": string[],
  "unknowns": [{ "propertyId": string, "status": "not-found" | "search-failed", "reason": string, "wouldResolve": string }],
  "questionBack": { "ambiguity": string, "readings": [{ "reading": string, "whatItWouldChange": string }] },
  "refusal": { "status": "not-found" | "search-failed" | "unresolvable", "reason": string }
}`;

export function buildOfficeRulesSystemPrompt(): string {
  return [
    'You are the reasoning half of a product-selection assistant for a design office.',
    'You propose and never assert: a deterministic checker resolves every reference you make and',
    'rejects anything it cannot resolve to a library record. Your draft is a proposal, not an answer.',
    '',
    'Office rules:',
    ...OFFICE_RULES.map((rule, index) => `${index + 1}. ${rule}`),
  ].join('\n');
}

/** One line per record — evidence and verification state, so the model can judge fit and reference ids. */
export function describeRecord(record: LibraryRecord): string {
  const kind =
    record.kind === 'value'
      ? `property '${record.propertyId}', value exactly as recorded: '${record.raw}', method '${record.methodId}'`
      : 'passage';
  const scope = record.productId ? `, product '${record.productId}'` : '';
  const verified =
    record.verification === 'human-verified'
      ? `, verified by ${record.verifiedBy ?? '(verifier unnamed)'}`
      : ', not human-verified';
  return `- ${record.id} — ${record.documentTitle}, ${record.locator} (${kind}${scope}; authority ${record.authority}; verification ${record.verification}${verified}): "${record.quote}"`;
}

export function buildReasonerPrompt(question: string, records: readonly LibraryRecord[]): string {
  const catalog =
    records.length === 0
      ? '(none — the library search returned no records)'
      : records.map((record) => describeRecord(record)).join('\n');
  return [
    "The question, in the user's own words:",
    question,
    '',
    'Library search returned these records — the only record ids you may reference:',
    catalog,
    '',
    'Respond with JSON only (no prose, no code fence), shaped exactly as:',
    DRAFT_JSON_SHAPE,
  ].join('\n');
}
