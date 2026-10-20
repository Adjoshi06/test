// Part 3 of the answer — the candidate matrix, one row per product, one column
// per requirement. Every cell is computed by the assertion checker from recorded
// evidence: meet, fail, or unknown, always with the computed reason — the UI
// never judges. A cell's evidence records are one click away (the drawer opens
// wherever the orchestrating view can open one).

import type { CandidateResult, CheckedAnswer, RequirementResult } from '@/lib/checker/types';

const VERDICT_MARK: Record<RequirementResult['verdict'], string> = {
  meet: '✓',
  fail: '✗',
  unknown: '?',
};

const VERDICT_WORD: Record<RequirementResult['verdict'], string> = {
  meet: 'meets',
  fail: 'fails',
  unknown: 'unknown',
};

function MatrixCell({
  cell,
  onOpenEvidence,
}: {
  cell: RequirementResult;
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  const openable = onOpenEvidence !== undefined && cell.evidence.length > 0;
  return (
    <td className={`matrix-cell verdict-${cell.verdict}`}>
      <span className="verdict-line">
        <span aria-hidden="true" className="verdict-mark">
          {VERDICT_MARK[cell.verdict]}
        </span>{' '}
        {VERDICT_WORD[cell.verdict]}
      </span>
      <span className="cell-reason">{cell.reason}</span>
      {cell.comparability && (
        <span className="cell-comparability">
          {cell.comparability.basis}: {cell.comparability.reason}
        </span>
      )}
      {cell.wouldResolve && (
        <span className="cell-resolve">would resolve: {cell.wouldResolve}</span>
      )}
      {openable && (
        <button
          type="button"
          className="button subtle evidence-open"
          onClick={() => onOpenEvidence(cell.evidence.map((r) => r.id))}
        >
          {cell.evidence.length} source{cell.evidence.length === 1 ? '' : 's'} — one click away
        </button>
      )}
    </td>
  );
}

export function CandidateMatrix({
  requirements,
  results,
  onOpenEvidence,
}: {
  requirements: CheckedAnswer['requirements'];
  results: readonly CandidateResult[];
  onOpenEvidence?: (recordIds: readonly string[]) => void;
}) {
  if (results.length === 0) return null;
  return (
    <section className="answer-part" data-part="3" aria-label="Candidates by requirement">
      <h2 className="answer-part-title">
        <span className="answer-part-number">03</span> Candidates × requirements — computed from
        recorded evidence
      </h2>
      <div className="matrix-scroll">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="matrix-product-col">
                Candidate
              </th>
              {requirements.map((req) => (
                <th scope="col" key={req.propertyId}>
                  {req.statement}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((row) => (
              <tr key={row.productId}>
                <th scope="row" className="matrix-product">
                  {row.productId}
                </th>
                {row.results.map((cell) => (
                  <MatrixCell
                    key={`${row.productId}:${cell.requirementIndex}`}
                    cell={cell}
                    onOpenEvidence={onOpenEvidence}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
