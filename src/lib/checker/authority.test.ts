// Authority tests — the enforcement half (spec art_Ene8eA8R): firm knowledge
// may add a requirement and never relax a code; requirements that cannot both
// hold are kept and surfaced, never blended; recorded values that disagree are
// both shown with their authorities.

import { describe, expect, it } from 'vitest';
import type { LibraryRecord, LibraryValueRecord } from '@/lib/reasoner/types';
import type { CheckedRequirement } from './types';
import {
  checksAreDisjoint,
  surfaceEvidenceConflicts,
  surfaceRequirementConflicts,
} from './authority';

const requirement = (over: Partial<CheckedRequirement>): CheckedRequirement => ({
  propertyId: 'fire-rating',
  statement: 'flame-spread class B or better',
  source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
  check: { kind: 'raw-equals', raw: 'class B-s1,d0', methodId: 'en-13501-1:2018' },
  ...over,
});

const value = (over: Partial<LibraryValueRecord>): LibraryValueRecord => ({
  id: 'rec-1',
  kind: 'value',
  productId: 'halden-task-chair',
  propertyId: 'fire-rating',
  raw: 'class B-s1,d0',
  methodId: 'en-13501-1:2018',
  documentId: 'doc-1',
  documentTitle: 'Halden data sheet',
  locator: 'p. 4, §2.1',
  quote: 'B-s1,d0 per EN 13501-1',
  authority: 'product-doc',
  verification: 'human-verified',
  verifiedBy: 'A. Designer',
  ...over,
});

describe('checksAreDisjoint — only provable impossibility counts', () => {
  it('present and absent contradict; raw-equals disagrees with a different raw-equals', () => {
    expect(checksAreDisjoint({ kind: 'present' }, { kind: 'absent' })).toBe(true);
    expect(
      checksAreDisjoint({ kind: 'raw-equals', raw: 'B' }, { kind: 'raw-equals', raw: 'C' })
    ).toBe(true);
  });

  it('equals vs not-equals of the same raw contradict', () => {
    expect(
      checksAreDisjoint({ kind: 'raw-equals', raw: 'B' }, { kind: 'raw-not-equals', raw: 'B' })
    ).toBe(true);
    expect(
      checksAreDisjoint({ kind: 'raw-not-equals', raw: 'B' }, { kind: 'raw-equals', raw: 'B' })
    ).toBe(true);
  });

  it('compat pairs are not conflicts: same raw, two not-equals, equals vs other not-equals', () => {
    expect(
      checksAreDisjoint({ kind: 'raw-equals', raw: 'B' }, { kind: 'raw-equals', raw: 'B' })
    ).toBe(false);
    expect(
      checksAreDisjoint({ kind: 'raw-not-equals', raw: 'B' }, { kind: 'raw-not-equals', raw: 'C' })
    ).toBe(false);
    expect(
      checksAreDisjoint({ kind: 'raw-equals', raw: 'B' }, { kind: 'raw-not-equals', raw: 'C' })
    ).toBe(false);
    expect(checksAreDisjoint({ kind: 'present' }, { kind: 'raw-equals', raw: 'B' })).toBe(false);
  });
});

describe('surfaceRequirementConflicts — both kept, the disagreement named', () => {
  it('a firm requirement that contradicts a code is surfaced with the code first', () => {
    const requirements = [
      requirement({
        source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
        check: { kind: 'raw-equals', raw: 'class B-s1,d0' },
      }),
      requirement({
        statement: 'class C is acceptable for this project',
        source: { kind: 'firm', ref: 'firm memo 2026-09' },
        check: { kind: 'raw-equals', raw: 'class C-s1,d0' },
      }),
    ];
    const conflicts = surfaceRequirementConflicts(requirements);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('requirement');
    expect(conflicts[0]?.requirementIndexes).toEqual([0, 1]);
    expect(conflicts[0]?.description).toContain('never relax a code');
    // The requirements themselves are untouched — enforcement never drops.
    expect(requirements).toHaveLength(2);
  });

  it('two code requirements that disagree are surfaced as a code disagreement', () => {
    const requirements = [
      requirement({
        source: { kind: 'code', ref: 'IBC 2024 §10.3.2' },
        check: { kind: 'raw-equals', raw: 'class B-s1,d0' },
      }),
      requirement({
        source: { kind: 'code', ref: 'EN 13501-1:2018' },
        check: { kind: 'raw-equals', raw: 'class C-s1,d0' },
      }),
    ];
    const conflicts = surfaceRequirementConflicts(requirements);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.description).toContain('two code requirements disagree');
  });

  it('present vs absent and equals vs not-equals surface; different properties do not', () => {
    const presentAbsent = surfaceRequirementConflicts([
      requirement({ check: { kind: 'present' } }),
      requirement({
        statement: 'the property must not appear',
        source: { kind: 'user' },
        check: { kind: 'absent' },
      }),
    ]);
    expect(presentAbsent).toHaveLength(1);
    const differentProperties = surfaceRequirementConflicts([
      requirement({ propertyId: 'fire-rating', check: { kind: 'raw-equals', raw: 'B' } }),
      requirement({
        propertyId: 'finish',
        statement: 'black',
        source: { kind: 'user' },
        check: { kind: 'raw-equals', raw: 'black' },
      }),
    ]);
    expect(differentProperties).toHaveLength(0);
  });

  it('compatible requirements raise nothing — even on the same property', () => {
    const conflicts = surfaceRequirementConflicts([
      requirement({ check: { kind: 'raw-equals', raw: 'class B-s1,d0' } }),
      requirement({
        statement: 'the same class, restated',
        source: { kind: 'user' },
        check: { kind: 'raw-equals', raw: 'class B-s1,d0' },
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('requirements without readable checks never produce conflicts', () => {
    const conflicts = surfaceRequirementConflicts([
      requirement({ check: undefined }),
      requirement({
        statement: 'anything',
        source: { kind: 'user' },
        check: { kind: 'raw-equals', raw: 'C' },
      }),
    ]);
    expect(conflicts).toHaveLength(0);
  });
});

describe('surfaceEvidenceConflicts — disagreement shown, never resolved', () => {
  it('two values that disagree on one property of one product are both named', () => {
    const records: LibraryRecord[] = [
      value({ id: 'rec-a', raw: 'class B-s1,d0' }),
      value({
        id: 'rec-b',
        raw: 'class C-s1,d0',
        authority: 'correspondence',
        locator: 'msg 14 Mar',
      }),
    ];
    const conflicts = surfaceEvidenceConflicts(records);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('evidence');
    expect(conflicts[0]?.productId).toBe('halden-task-chair');
    expect(conflicts[0]?.recordIds).toEqual(['rec-a', 'rec-b']);
    expect(conflicts[0]?.description).toContain('class B-s1,d0');
    expect(conflicts[0]?.description).toContain('class C-s1,d0');
    expect(conflicts[0]?.description).toContain('neither is blended');
  });

  it('agreeing duplicates and other products do not conflict', () => {
    const records: LibraryRecord[] = [
      value({ id: 'rec-a', raw: 'class B-s1,d0' }),
      value({ id: 'rec-b', raw: 'class B-s1,d0', locator: 'p. 5' }),
      value({ id: 'rec-c', raw: 'class C-s1,d0', productId: 'mera-conference' }),
    ];
    expect(surfaceEvidenceConflicts(records)).toHaveLength(0);
  });

  it('passages never enter evidence conflicts', () => {
    const records: LibraryRecord[] = [
      value({ id: 'rec-a', raw: 'class B-s1,d0' }),
      {
        id: 'rec-b',
        kind: 'passage',
        documentId: 'doc-1',
        documentTitle: 'Correspondence',
        locator: 'msg 14 Mar',
        quote: 'class C-s1,d0 was mentioned',
        authority: 'correspondence',
        verification: 'interpreted',
      },
    ];
    expect(surfaceEvidenceConflicts(records)).toHaveLength(0);
  });
});
