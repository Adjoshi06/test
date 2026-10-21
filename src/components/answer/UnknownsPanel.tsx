// Part 5 of the answer — what is unknown, and what would resolve it. The two
// search outcomes stay distinct (spec promise: unknown is an answer): not-found
// is absence of evidence, never evidence of absence; search-failed means the
// search did not complete. The checker's own strip outcomes carry its reason
// verbatim. A row's referenced record opens in the drawer when the view can
// resolve it.

import type { CheckedUnknown, CheckedUnknownStatus } from '@/lib/checker/types';

const STATUS_HEADLINE: Record<CheckedUnknownStatus, string> = {
  'not-found': 'Not found — a search ran and found none',
  'search-failed': 'Search failed — the search did not complete',
  'unresolved-ref': 'Not resolvable — no visible library record answers the reference',
  unattributable: 'Belongs to another product — the reference may not be re-attributed',
  'not-a-value': 'Source text, not a value — nobody has read a value out of it',
  unreadable: 'Unreadable — the record could not be read at all',
};

export function UnknownRow({
  unknown,
  onOpenEvidence,
}: {
  unknown: CheckedUnknown;
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  return (
    <li className="unknown-row" data-status={unknown.status}>
      <p className="unknown-headline">
        <span className="unknown-property">
          {unknown.propertyId === '*' ? 'The whole question' : unknown.propertyId}
        </span>
        <span className="unknown-status">{STATUS_HEADLINE[unknown.status]}</span>
      </p>
      <p className="unknown-reason">{unknown.reason}</p>
      <p className="unknown-resolve">would resolve: {unknown.wouldResolve}</p>
      {onOpenEvidence !== undefined && unknown.recordId !== undefined && (
        <button
          type="button"
          className="button subtle evidence-open"
          onClick={() => onOpenEvidence([unknown.recordId as string])}
        >
          View the referenced record
        </button>
      )}
    </li>
  );
}

export function UnknownsPanel({
  unknowns,
  onOpenEvidence,
}: {
  unknowns: readonly CheckedUnknown[];
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  if (unknowns.length === 0) return null;
  return (
    <section className="answer-part" data-part="5" aria-label="What is unknown">
      <h2 className="answer-part-title">
        <span className="answer-part-number">05</span> Unknown — and what would resolve it
      </h2>
      <ul className="unknowns-list">
        {unknowns.map((unknown) => (
          <UnknownRow
            key={`${unknown.propertyId}:${unknown.status}:${unknown.reason}`}
            unknown={unknown}
            onOpenEvidence={onOpenEvidence}
          />
        ))}
      </ul>
    </section>
  );
}
