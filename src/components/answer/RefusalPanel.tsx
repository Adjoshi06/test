// The refusal — the sources cannot support an answer, and the panel says so
// plainly, with its reason (spec promise: stops rather than guesses on). A
// refusal keeps the six-part discipline where it can: what was understood still
// renders above it, and the unknown rows that report the failed search render
// below it, distinctly — never as a value, never as absence-as-fact.

import type { Refusal, RefusalStatus } from '@/lib/reasoner/types';
import { UnknownRow } from './UnknownsPanel';
import type { CheckedUnknown } from '@/lib/checker/types';

const STATUS_HEADLINE: Record<RefusalStatus, string> = {
  'not-found': 'Not found — a search ran and found none',
  'search-failed': 'Search failed — the search did not complete',
  unresolvable: 'Unresolvable — the reply could not be grounded in library records',
};

export function RefusalPanel({
  refusal,
  unknowns,
  onOpenEvidence,
}: {
  refusal: Refusal;
  unknowns: readonly CheckedUnknown[];
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  return (
    <section className="answer-part refusal" data-outcome-panel="refuse" aria-label="No answer">
      <h2 className="answer-part-title">
        <span className="refusal-status" data-status={refusal.status}>
          {STATUS_HEADLINE[refusal.status]}
        </span>{' '}
        — no answer
      </h2>
      <p className="refusal-reason">{refusal.reason}</p>
      {unknowns.length > 0 && (
        <ul className="unknowns-list">
          {unknowns.map((unknown) => (
            <UnknownRow
              key={`${unknown.propertyId}:${unknown.status}:${unknown.reason}`}
              unknown={unknown}
              onOpenEvidence={onOpenEvidence}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
