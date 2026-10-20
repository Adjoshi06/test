// Authority — the enforcement half of the assertion checker (spec art_Ene8eA8R,
// "Two authorities"). Codes establish requirements; firm knowledge may add a
// requirement and never relax a code. Enforcement here is structural: code
// requirements are never dropped or overridden, and when two requirements on
// one property cannot both hold, both are kept and the disagreement is
// surfaced — never blended into one lenient column.
//
// The same honesty governs recorded values: two records that disagree about
// one property of one product are both shown, with their authorities and
// locators — the checker does not pick a winner.

import type { LibraryRecord, LibraryValueRecord, RequirementCheck } from '@/lib/reasoner/types';
import type { CheckedConflict, CheckedRequirement } from './types';

/** Describe a requirement's source for a conflict reason. */
function sourceLabel(requirement: CheckedRequirement): string {
  switch (requirement.source.kind) {
    case 'user':
      return 'the user';
    case 'project':
      return `the project (${requirement.source.ref})`;
    case 'firm':
      return `firm knowledge (${requirement.source.ref})`;
    case 'code':
      return `code ${requirement.source.ref}`;
    case 'inference':
      return `the assistant's inference (${requirement.source.basis})`;
  }
}

/**
 * Whether two checks can never both be satisfied. Conservative: only
 * provable disjointness counts — anything else (including a missing check)
 * lets both requirements stand without a conflict verdict.
 */
export function checksAreDisjoint(a: RequirementCheck, b: RequirementCheck): boolean {
  if (a.kind === 'present' && b.kind === 'absent') return true;
  if (a.kind === 'absent' && b.kind === 'present') return true;
  if (a.kind === 'raw-equals' && b.kind === 'raw-equals') return a.raw !== b.raw;
  if (a.kind === 'raw-equals' && b.kind === 'raw-not-equals') return a.raw === b.raw;
  if (a.kind === 'raw-not-equals' && b.kind === 'raw-equals') return a.raw === b.raw;
  return false;
}

/**
 * Surface requirement conflicts: every pair of requirements on one property
 * whose checks provably cannot both hold. The pair is described, never
 * resolved — the code column (when there is one) stays computed from the code,
 * and the disagreement rides in `CheckedAnswer.conflicts`.
 */
export function surfaceRequirementConflicts(
  requirements: readonly CheckedRequirement[]
): CheckedConflict[] {
  const conflicts: CheckedConflict[] = [];
  for (let i = 0; i < requirements.length; i++) {
    for (let j = i + 1; j < requirements.length; j++) {
      const a = requirements[i];
      const b = requirements[j];
      if (a === undefined || b === undefined) continue;
      if (a.propertyId !== b.propertyId) continue;
      if (a.check === undefined || b.check === undefined) continue;
      if (!checksAreDisjoint(a.check, b.check)) continue;
      const codeSide = a.source.kind === 'code' ? i : b.source.kind === 'code' ? j : undefined;
      const other = codeSide === i ? j : i;
      const relationship =
        a.source.kind === 'code' && b.source.kind === 'code'
          ? 'two code requirements disagree — both are shown with their jurisdictions'
          : codeSide !== undefined
            ? 'firm knowledge may add a requirement, never relax a code — both are shown, and compliance follows the code'
            : 'the two requirements cannot both hold — both are shown, neither is blended';
      conflicts.push({
        kind: 'requirement',
        propertyId: a.propertyId,
        requirementIndexes: codeSide !== undefined ? [codeSide, other] : [i, j],
        description: `'${a.statement}' (${sourceLabel(a)}) and '${b.statement}' (${sourceLabel(b)}) cannot both hold for '${a.propertyId}' — ${relationship}`,
      });
    }
  }
  return conflicts;
}

/**
 * Surface evidence conflicts: two recorded values that disagree about one
 * property of one product. Both ride into the answer with their authorities
 * and locators; the checker picks no winner — a human reads the disagreement.
 */
export function surfaceEvidenceConflicts(records: readonly LibraryRecord[]): CheckedConflict[] {
  const byProperty = new Map<string, LibraryValueRecord[]>();
  for (const record of records) {
    if (record.kind !== 'value') continue;
    const key = JSON.stringify([record.productId, record.propertyId]);
    const group = byProperty.get(key);
    if (group === undefined) byProperty.set(key, [record]);
    else group.push(record);
  }
  const conflicts: CheckedConflict[] = [];
  for (const group of byProperty.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const first = sorted[0];
    if (first === undefined) continue;
    const rest = sorted.slice(1);
    const disagreeing = rest.filter((r) => r.raw !== first.raw);
    if (disagreeing.length === 0) continue;
    const sides = sorted.map((r) => `'${r.raw}' (${r.authority}, ${r.locator})`).join(' and ');
    conflicts.push({
      kind: 'evidence',
      propertyId: first.propertyId,
      productId: first.productId,
      description: `recorded values for '${first.propertyId}' of '${first.productId}' disagree: ${sides} — both are shown, neither is blended`,
      recordIds: sorted.map((r) => r.id),
    });
  }
  return conflicts;
}
