// Authorities that disagree, both shown — never blended (spec promise). The
// checker computes the conflicts; this panel only renders them, each side
// verbatim, with the records behind an evidence conflict reachable in the
// drawer where the view can open one.

import type { CheckedAnswer, CheckedConflict } from '@/lib/checker/types';

const KIND_HEADLINE: Record<CheckedConflict['kind'], string> = {
  evidence: 'Recorded values disagree',
  requirement: 'A requirement contradicts a code',
};

export function ConflictsPanel({
  conflicts,
  evidenceById,
  onOpenEvidence,
}: {
  conflicts: readonly CheckedConflict[];
  evidenceById: ReadonlyMap<string, CheckedAnswer['evidence'][number]>;
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  if (conflicts.length === 0) return null;
  return (
    <section className="answer-part conflicts" aria-label="Disagreements in the sources">
      <h2 className="answer-part-title">Authorities disagree — both shown, neither blended</h2>
      <ul className="conflicts-list">
        {conflicts.map((conflict) => {
          const recordIds = conflict.recordIds ?? [];
          const openable =
            onOpenEvidence !== undefined &&
            recordIds.length > 0 &&
            recordIds.every((id) => evidenceById.has(id));
          return (
            <li
              key={`${conflict.kind}:${conflict.propertyId}:${conflict.productId ?? ''}:${conflict.description}`}
              className="conflict-row"
              data-kind={conflict.kind}
            >
              <p className="conflict-headline">
                {KIND_HEADLINE[conflict.kind]} — {conflict.propertyId}
                {conflict.productId !== undefined ? `, ${conflict.productId}` : ''}
              </p>
              <p className="conflict-description">{conflict.description}</p>
              {openable && (
                <button
                  type="button"
                  className="button subtle evidence-open"
                  onClick={() => onOpenEvidence(recordIds)}
                >
                  {recordIds.length} disagreeing records — one click away
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
