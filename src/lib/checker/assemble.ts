// Assembly — the composition of the assertion checker (spec art_Ene8eA8R,
// "Two authorities"). Pure: an untrusted draft plus injected lookups in, a
// CheckedAnswer out. This is the only function that produces the answer shape
// the UI renders — there is no presentation path that bypasses it, which is
// the boundary invariant made structural.
//
// Clarify and refuse short-circuit before any computation: a question back
// renders the named ambiguity and its readings; a refusal renders its reason.
// Only an answer computes the candidate matrix.

import type { LibraryRecord } from '@/lib/reasoner/types';
import { surfaceEvidenceConflicts, surfaceRequirementConflicts } from './authority';
import { computeCandidate } from './compute';
import type { CheckedAnswer, CheckedConflict, CheckedUnknown, Comparator } from './types';
import { readDraft, resolveCandidate } from './resolve';

export interface AssembleInput {
  /** The reasoner's proposal, untrusted — read and validated here. */
  draft: unknown;
  /** Viewer-scoped library lookups, injected — visibility is decided before the checker runs. */
  records: ReadonlyMap<string, LibraryRecord | null>;
  /** Prefetched registry decisions over the pure comparison lookup. */
  compare: Comparator;
}

/**
 * Compose the checked answer. Every proposed reference resolves to a validated
 * value or is stripped to an unknown with its reason and what would resolve
 * it; every verdict is computed from recorded evidence; authority conflicts
 * and evidence disagreements are surfaced, never blended.
 */
export function assembleAnswer(input: AssembleInput): CheckedAnswer {
  const draft = readDraft(input.draft);

  if (draft.outcome === 'clarify') {
    return {
      outcome: 'clarify',
      interpretation: draft.interpretation,
      requirements: [],
      results: [],
      commentary: draft.commentary,
      unknowns: draft.unknowns,
      evidence: [],
      conflicts: [],
      questionBack: draft.questionBack,
    };
  }

  if (draft.outcome === 'refuse') {
    return {
      outcome: 'refuse',
      interpretation: draft.interpretation,
      requirements: [],
      results: [],
      commentary: draft.commentary,
      unknowns: draft.unknowns,
      evidence: [],
      conflicts: [],
      refusal: draft.refusal,
    };
  }

  // Answer: resolve claims, compute the matrix, surface conflicts.
  const unknowns: CheckedUnknown[] = [...draft.unknowns];
  const seenProducts = new Set<string>();
  const results: CheckedAnswer['results'] = [];
  const resolvedRecords: LibraryRecord[] = [];
  const recordIds = new Set<string>();
  const conflicts: CheckedConflict[] = [];

  for (const candidate of draft.candidates) {
    // One row per product — a duplicated candidate adds nothing the first row
    // does not already carry.
    if (seenProducts.has(candidate.productId)) continue;
    seenProducts.add(candidate.productId);
    const { resolved, stripped } = resolveCandidate(candidate, input.records);
    unknowns.push(...stripped);
    results.push(
      computeCandidate(resolved.productId, resolved.values, draft.requirements, input.compare)
    );
    for (const record of resolved.values) {
      if (!recordIds.has(record.id)) {
        recordIds.add(record.id);
        resolvedRecords.push(record);
      }
    }
  }

  conflicts.push(...surfaceRequirementConflicts(draft.requirements));
  conflicts.push(...surfaceEvidenceConflicts(resolvedRecords));

  return {
    outcome: 'answer',
    interpretation: draft.interpretation,
    requirements: draft.requirements,
    results,
    commentary: draft.commentary,
    unknowns,
    evidence: [...resolvedRecords].sort((a, b) => a.id.localeCompare(b.id)),
    conflicts,
  };
}
