// The real provider adapter — Claude behind the same Reasoner interface the
// scripted fake implements. The adapter is the only module that talks to a
// provider, and even here the model never asserts: its reply is parsed into a
// draft whose claims are rebuilt as bare record references (any field the model
// attached to a claim — a value, a quote — cannot cross the boundary), ids the
// search did not return are dropped to unknowns, and anything unparseable
// becomes a refusal, never a guess.
//
// The API key arrives from an injected secret (env) — never hardcoded. When no
// key is present (CI, local tests) createClaudeReasoner reports unavailable and
// the fake reasoner covers the tests.

import { buildOfficeRulesSystemPrompt, buildReasonerPrompt } from './prompt';
import type { LibrarySearchResult, LibrarySearchTool } from './search';
import type {
  AnswerDraft,
  ClarifyReading,
  Interpretation,
  LibraryRecord,
  ProposedCandidate,
  ProposedClaim,
  ProposedRequirement,
  ProposedUnknown,
  QuestionBack,
  Reasoner,
  ReasonerInput,
  Refusal,
  RefusalStatus,
  RequirementSource,
  UnknownStatus,
} from './types';
import { refusalDraft } from './types';

// The Obvious runtime injects stored secrets with a SECRET_ prefix; a plain
// deployment sets the bare name. Both are checked, in that order.
export const API_KEY_ENV_VARS = ['SECRET_ANTHROPIC_API_KEY', 'ANTHROPIC_API_KEY'] as const;

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5';

export type ClaudeAvailability =
  { available: true; reasoner: ClaudeReasoner } | { available: false; reason: string };

export function createClaudeReasoner(
  search: LibrarySearchTool,
  env: Readonly<Record<string, string | undefined>> = process.env
): ClaudeAvailability {
  const key = API_KEY_ENV_VARS.map((name) => env[name]).find(
    (value) => value !== undefined && value !== ''
  );
  if (key === undefined) {
    return {
      available: false,
      reason: `No API key in env (looked for ${API_KEY_ENV_VARS.join(' or ')}); the adapter is skipped and the fake reasoner covers the tests.`,
    };
  }
  return { available: true, reasoner: new ClaudeReasoner(search, key) };
}

export interface ClaudeRequest {
  model: string;
  maxTokens: number;
  system: string;
  prompt: string;
  apiKey: string;
}

/**
 * Sends one provider request and returns the assistant text. Injectable so no
 * test touches the network; the default calls the Anthropic Messages API.
 */
export type ClaudeTransport = (request: ClaudeRequest) => Promise<string>;

export class ClaudeProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeProviderError';
  }
}

const ANTHROPIC_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';

export const defaultTransport: ClaudeTransport = async (request) => {
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': request.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });
  } catch (error) {
    throw new ClaudeProviderError(
      `Anthropic API unreachable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!response.ok) {
    throw new ClaudeProviderError(`Anthropic API returned ${response.status}`);
  }
  return assistantText(await response.json());
};

function assistantText(payload: unknown): string {
  const content = isObject(payload) ? payload['content'] : undefined;
  if (!Array.isArray(content)) {
    throw new ClaudeProviderError('Anthropic API response had no content array');
  }
  const text = content
    .filter(isObject)
    .filter((block) => block['type'] === 'text' && typeof block['text'] === 'string')
    .map((block) => block['text'] as string)
    .join('');
  if (text.trim() === '') {
    throw new ClaudeProviderError('Anthropic API response had no text blocks');
  }
  return text;
}

export interface ClaudeReasonerOptions {
  model?: string;
  maxTokens?: number;
  transport?: ClaudeTransport;
}

export class ClaudeReasoner implements Reasoner {
  readonly name = 'claude';

  constructor(
    private readonly search: LibrarySearchTool,
    private readonly apiKey: string,
    private readonly options: ClaudeReasonerOptions = {}
  ) {}

  async answer({ question }: ReasonerInput): Promise<AnswerDraft> {
    let searchResult: LibrarySearchResult;
    try {
      searchResult = await this.search.search({ terms: question });
    } catch (error) {
      // A failed search is its own outcome — reported, never blended with not-found.
      return searchFailedDraft(question, error);
    }

    let raw: string;
    try {
      raw = await (this.options.transport ?? defaultTransport)({
        model: this.options.model ?? DEFAULT_CLAUDE_MODEL,
        maxTokens: this.options.maxTokens ?? 1024,
        system: buildOfficeRulesSystemPrompt(),
        prompt: buildReasonerPrompt(question, searchResult.records),
        apiKey: this.apiKey,
      });
    } catch (error) {
      return refusalDraft(question, {
        status: 'unresolvable',
        reason: `The reasoning model did not complete: ${errorMessage(error)}`,
      });
    }

    return parseModelDraft(raw, searchResult.records, question).draft;
  }
}

// --- Reply parsing -------------------------------------------------------------
// Untrusted model text in, well-formed proposal out. Every coercion is recorded
// in `coercions` — nothing is dropped silently.

export interface ParsedDraft {
  draft: AnswerDraft;
  /** How the raw reply was coerced to fit the draft types — each drop is visible. */
  coercions: string[];
  /** Record ids the model referenced that the search did not return. */
  droppedRecordIds: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseModelDraft(
  raw: string,
  records: readonly LibraryRecord[],
  question: string
): ParsedDraft {
  const coercions: string[] = [];
  const refuse = (refusal: Refusal): ParsedDraft => ({
    draft: refusalDraft(question, refusal),
    coercions,
    droppedRecordIds: [],
  });

  const extracted = extractJson(raw);
  if (!extracted.ok) {
    coercions.push(extracted.error);
    return refuse({
      status: 'unresolvable',
      reason: `The reasoning model's reply could not be parsed as JSON — refusing rather than guess.`,
    });
  }
  if (!isObject(extracted.value)) {
    coercions.push('reply was JSON but not an object');
    return refuse({
      status: 'unresolvable',
      reason: "The reasoning model's reply was not a JSON object — refusing rather than guess.",
    });
  }
  const rawDraft = extracted.value;

  const scope = new Set(records.map((record) => record.id));
  const { candidates, droppedRecordIds } = mapCandidates(rawDraft['candidates'], scope, coercions);
  if (droppedRecordIds.length > 0) {
    coercions.push(
      `dropped ${droppedRecordIds.length} claim(s) referencing ids the search did not return: ${droppedRecordIds.join(', ')}`
    );
  }
  const unknowns = mapUnknowns(rawDraft['unknowns'], coercions);
  if (droppedRecordIds.length > 0) {
    unknowns.push({
      propertyId: '*',
      status: 'not-found',
      reason: `The reasoner referenced record(s) the library search did not return: ${droppedRecordIds.join(', ')}.`,
      wouldResolve: 'Re-run the question with a broader library search.',
    });
  }

  const outcome = rawDraft['outcome'];
  if (outcome === 'clarify') {
    const questionBack = mapQuestionBack(rawDraft['questionBack'], coercions);
    if (questionBack !== undefined && questionBack.readings.length > 0) {
      if (candidates.length > 0) {
        coercions.push(
          'outcome was clarify — candidates dropped: no answer until a reading is chosen'
        );
      }
      return {
        draft: {
          outcome: 'clarify',
          interpretation: mapInterpretation(rawDraft['interpretation'], coercions),
          requirements: mapRequirements(rawDraft['requirements'], coercions),
          candidates: [],
          commentary: mapCommentary(rawDraft['commentary'], coercions),
          unknowns,
          questionBack,
        },
        coercions,
        droppedRecordIds,
      };
    }
    coercions.push('outcome was clarify without a usable questionBack — coerced to refuse');
    return refuse({
      status: 'unresolvable',
      reason: 'The reasoning model asked back but named no readings — refusing rather than guess.',
    });
  }

  if (outcome === 'refuse') {
    const refusal = mapRefusal(rawDraft['refusal'], coercions);
    if (refusal !== undefined) {
      if (candidates.length > 0) coercions.push('outcome was refuse — candidates dropped');
      return {
        draft: refusalDraft(question, refusal, unknowns),
        coercions,
        droppedRecordIds,
      };
    }
    coercions.push('outcome was refuse without a usable refusal — coerced to unresolvable');
    return refuse({
      status: 'unresolvable',
      reason: 'The reasoning model refused without a reason.',
    });
  }

  if (outcome === 'answer') {
    if (candidates.length === 0 && unknowns.length === 0) {
      coercions.push('outcome was answer with no references and no unknowns — coerced to refuse');
      return refuse({
        status: 'unresolvable',
        reason: 'The reasoning model proposed no library references — refusing rather than guess.',
      });
    }
    return {
      draft: {
        outcome: 'answer',
        interpretation: mapInterpretation(rawDraft['interpretation'], coercions),
        requirements: mapRequirements(rawDraft['requirements'], coercions),
        candidates,
        commentary: mapCommentary(rawDraft['commentary'], coercions),
        unknowns,
      },
      coercions,
      droppedRecordIds,
    };
  }

  coercions.push(`outcome ${JSON.stringify(outcome ?? null)} unrecognized — coerced to refuse`);
  return refuse({
    status: 'unresolvable',
    reason: 'The reasoning model returned no recognizable outcome — refusing rather than guess.',
  });
}

type JsonExtract = { ok: true; value: unknown } | { ok: false; error: string };

function extractJson(raw: string): JsonExtract {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    return { ok: false, error: `reply was not valid JSON: ${errorMessage(error)}` };
  }
}

const UNKNOWN_STATUSES: readonly UnknownStatus[] = ['not-found', 'search-failed'];
const REFUSAL_STATUSES: readonly RefusalStatus[] = ['not-found', 'search-failed', 'unresolvable'];

function mapInterpretation(value: unknown, coercions: string[]): Interpretation[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    coercions.push('interpretation was not an array and was dropped');
    return [];
  }
  return value.filter(isObject).map((entry): Interpretation => {
    const rawTranslations = Array.isArray(entry['translations']) ? entry['translations'] : [];
    const translations = rawTranslations
      .filter(isObject)
      .filter((entry2) => {
        const ok =
          typeof entry2['layTerm'] === 'string' &&
          entry2['layTerm'] !== '' &&
          typeof entry2['explicitTerm'] === 'string' &&
          entry2['explicitTerm'] !== '';
        if (!ok) coercions.push('a lay translation without both terms was dropped');
        return ok;
      })
      .map((entry2) => ({
        layTerm: entry2['layTerm'] as string,
        explicitTerm: entry2['explicitTerm'] as string,
      }));
    const rawNeeds = Array.isArray(entry['inferredNeeds']) ? entry['inferredNeeds'] : [];
    return {
      statement:
        typeof entry['statement'] === 'string' && entry['statement'] !== ''
          ? entry['statement']
          : '(the reasoner gave no interpretation statement)',
      translations,
      inferredNeeds: rawNeeds.filter((need): need is string => typeof need === 'string'),
    };
  });
}

function mapRequirements(value: unknown, coercions: string[]): ProposedRequirement[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    coercions.push('requirements was not an array and was dropped');
    return [];
  }
  return value.filter(isObject).flatMap((entry): ProposedRequirement[] => {
    const propertyId = entry['propertyId'];
    const statement = entry['statement'];
    if (typeof propertyId !== 'string' || propertyId === '' || typeof statement !== 'string') {
      coercions.push('a requirement without propertyId or statement was dropped');
      return [];
    }
    return [{ propertyId, statement, source: mapSource(entry['source'], coercions) }];
  });
}

function mapSource(value: unknown, coercions: string[]): RequirementSource {
  if (!isObject(value) || typeof value['kind'] !== 'string') {
    coercions.push('a requirement source was missing or malformed — coerced to inference');
    return {
      kind: 'inference',
      basis: 'The reasoner gave no usable source; coerced by the adapter.',
    };
  }
  const kind = value['kind'];
  const ref = typeof value['ref'] === 'string' && value['ref'] !== '' ? value['ref'] : undefined;
  const basis =
    typeof value['basis'] === 'string' && value['basis'] !== '' ? value['basis'] : undefined;
  switch (kind) {
    case 'user':
      return { kind: 'user' };
    case 'project':
    case 'firm':
    case 'code':
      return { kind, ref: ref ?? '(no ref given)' };
    case 'inference':
      return { kind: 'inference', basis: basis ?? '(no basis given)' };
    default:
      coercions.push(`unrecognized requirement source kind "${kind}" — coerced to inference`);
      return {
        kind: 'inference',
        basis: `Unrecognized source kind "${kind}"; coerced by the adapter.`,
      };
  }
}

function mapCandidates(
  value: unknown,
  scope: ReadonlySet<string>,
  coercions: string[]
): { candidates: ProposedCandidate[]; droppedRecordIds: string[] } {
  if (value === undefined) return { candidates: [], droppedRecordIds: [] };
  if (!Array.isArray(value)) {
    coercions.push('candidates was not an array and was dropped');
    return { candidates: [], droppedRecordIds: [] };
  }
  const candidates: ProposedCandidate[] = [];
  const droppedRecordIds: string[] = [];
  for (const entry of value.filter(isObject)) {
    const productId = entry['productId'];
    if (typeof productId !== 'string' || productId.trim() === '') {
      coercions.push('a candidate without a productId was dropped');
      continue;
    }
    const rawClaims = Array.isArray(entry['claims']) ? entry['claims'] : [];
    const claims: ProposedClaim[] = [];
    for (const rawClaim of rawClaims.filter(isObject)) {
      const recordId = rawClaim['recordId'];
      if (typeof recordId !== 'string' || recordId.trim() === '') {
        coercions.push(`a claim on '${productId}' without a recordId was dropped`);
        continue;
      }
      // The model may only reference ids the search returned; anything else is
      // a malformed reference, dropped and reported.
      if (!scope.has(recordId)) {
        droppedRecordIds.push(recordId);
        continue;
      }
      // Rebuilt as a bare reference: any field the model attached to the claim
      // (a value, a quote) cannot cross the boundary.
      claims.push({ recordId });
    }
    candidates.push({ productId, claims });
  }
  return { candidates, droppedRecordIds };
}

function mapUnknowns(value: unknown, coercions: string[]): ProposedUnknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    coercions.push('unknowns was not an array and was dropped');
    return [];
  }
  return value.filter(isObject).flatMap((entry): ProposedUnknown[] => {
    const propertyId = entry['propertyId'];
    if (typeof propertyId !== 'string' || propertyId.trim() === '') {
      coercions.push('an unknown without a propertyId was dropped');
      return [];
    }
    const status = UNKNOWN_STATUSES.find((candidate) => candidate === entry['status']);
    if (status === undefined) {
      coercions.push(`unknown '${propertyId}': unrecognized status — coerced to not-found`);
    }
    const reason =
      typeof entry['reason'] === 'string' && entry['reason'].trim() !== ''
        ? entry['reason']
        : undefined;
    if (reason === undefined) coercions.push(`unknown '${propertyId}': empty reason — coerced`);
    const wouldResolve =
      typeof entry['wouldResolve'] === 'string' && entry['wouldResolve'].trim() !== ''
        ? entry['wouldResolve']
        : undefined;
    if (wouldResolve === undefined)
      coercions.push(`unknown '${propertyId}': empty wouldResolve — coerced`);
    return [
      {
        propertyId,
        status: status ?? 'not-found',
        reason: reason ?? 'The reasoner gave no reason for this unknown.',
        wouldResolve: wouldResolve ?? 'Not stated.',
      },
    ];
  });
}

function mapQuestionBack(value: unknown, coercions: string[]): QuestionBack | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || typeof value['ambiguity'] !== 'string' || value['ambiguity'] === '') {
    coercions.push('questionBack was malformed and was dropped');
    return undefined;
  }
  const rawReadings = Array.isArray(value['readings']) ? value['readings'] : [];
  const readings = rawReadings.filter(isObject).flatMap((entry): ClarifyReading[] => {
    const reading = entry['reading'];
    const whatItWouldChange = entry['whatItWouldChange'];
    if (typeof reading !== 'string' || reading === '' || typeof whatItWouldChange !== 'string') {
      coercions.push('a clarify reading without reading or what-it-would-change was dropped');
      return [];
    }
    return [{ reading, whatItWouldChange }];
  });
  return { ambiguity: value['ambiguity'], readings };
}

function mapRefusal(value: unknown, coercions: string[]): Refusal | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value) || typeof value['reason'] !== 'string' || value['reason'].trim() === '') {
    coercions.push('refusal was malformed and was dropped');
    return undefined;
  }
  const status = REFUSAL_STATUSES.find((candidate) => candidate === value['status']);
  if (status === undefined)
    coercions.push('refusal: unrecognized status — coerced to unresolvable');
  return { status: status ?? 'unresolvable', reason: value['reason'] };
}

function mapCommentary(value: unknown, coercions: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    coercions.push('commentary was not an array and was dropped');
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

function searchFailedDraft(question: string, error: unknown): AnswerDraft {
  const reason = `The library search did not complete: ${errorMessage(error)}`;
  return refusalDraft(question, { status: 'search-failed', reason }, [
    {
      propertyId: '*',
      status: 'search-failed',
      reason,
      wouldResolve: 'Retry the search once the library is available.',
    },
  ]);
}
