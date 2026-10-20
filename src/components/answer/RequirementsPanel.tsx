// Part 2 of the answer — which requirements applied and where each came from.
// Authority is never blended: the source is rendered with its kind — user,
// project, firm, code (with jurisdiction and edition in its ref), or the
// assistant's own inference, which is marked as judgment.

import type { CheckedRequirement } from '@/lib/checker/types';
import type { RequirementSource } from '@/lib/reasoner/types';

const SOURCE_LABEL: Record<RequirementSource['kind'], string> = {
  user: 'you',
  project: 'project',
  firm: 'firm records',
  code: 'code — binds',
  inference: 'assistant ✱',
};

export function RequirementSourceTag({ source }: { source: RequirementSource }) {
  const label = SOURCE_LABEL[source.kind];
  const ref =
    source.kind === 'project' || source.kind === 'firm' || source.kind === 'code'
      ? source.ref
      : source.kind === 'inference'
        ? source.basis
        : undefined;
  return (
    <span className="source-tag" data-source-kind={source.kind}>
      [{label}
      {ref !== undefined ? ` ${ref}` : ''}]
    </span>
  );
}

export function RequirementsPanel({
  requirements,
}: {
  requirements: readonly CheckedRequirement[];
}) {
  if (requirements.length === 0) return null;
  return (
    <section className="answer-part" data-part="2" aria-label="Requirements applied">
      <h2 className="answer-part-title">
        <span className="answer-part-number">02</span> Requirements applied
      </h2>
      <ul className="requirements-list">
        {requirements.map((req) => (
          <li key={req.propertyId} className="requirement-row">
            <span className="requirement-statement">{req.statement}</span>{' '}
            <RequirementSourceTag source={req.source} />
          </li>
        ))}
      </ul>
    </section>
  );
}
