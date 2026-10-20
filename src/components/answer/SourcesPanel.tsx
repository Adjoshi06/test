// Part 6 of the answer — every resolved record, deduplicated by the checker, in
// id order. One step from every value: each source opens in the evidence drawer
// where the view can open one, and each shows its document, locator, verbatim
// quote, authority, and verification state.

import type { CheckedAnswer } from '@/lib/checker/types';
import { EvidenceRecordCard } from './EvidenceRecordCard';

export function SourcesPanel({
  evidence,
  onOpenEvidence,
}: {
  evidence: CheckedAnswer['evidence'];
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  if (evidence.length === 0) return null;
  return (
    <section className="answer-part" data-part="6" aria-label="Sources">
      <h2 className="answer-part-title">
        <span className="answer-part-number">06</span> Sources ({evidence.length}) — one step away
      </h2>
      <ul className="sources-list">
        {evidence.map((record) => (
          <li key={record.id} className="source-item">
            {onOpenEvidence !== undefined ? (
              <button
                type="button"
                className="source-open"
                onClick={() => onOpenEvidence([record.id])}
                aria-label={`Open evidence for ${record.documentTitle}, ${record.locator}`}
              >
                <EvidenceRecordCard record={record} />
              </button>
            ) : (
              <EvidenceRecordCard record={record} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
