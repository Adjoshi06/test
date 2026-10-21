// One library record as evidence — the card used by the sources list (part 6)
// and the evidence drawer. Everything the spec promises about a value sits here:
// the document, where it sits, the verbatim quote, whose authority it carries,
// and its verification state — shown, never blended into a checked look.

import type { LibraryRecord } from '@/lib/reasoner/types';
import { AuthorityLabel, VerificationBadge } from './VerificationBadge';

export function EvidenceRecordCard({ record }: { record: LibraryRecord }) {
  return (
    <figure className="evidence-card" data-record-id={record.id}>
      <figcaption className="evidence-card-source">
        {record.documentTitle} · {record.locator}
      </figcaption>
      <blockquote className="evidence-card-quote">{record.quote}</blockquote>
      <div className="evidence-card-meta">
        <AuthorityLabel authority={record.authority} />
        <VerificationBadge verification={record.verification} verifiedBy={record.verifiedBy} />
      </div>
      {record.kind === 'value' && (
        <dl className="evidence-card-value">
          <div>
            <dt>Value</dt>
            <dd>{record.raw}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{record.methodId}</dd>
          </div>
          {record.productId && (
            <div>
              <dt>Product</dt>
              <dd>{record.productId}</dd>
            </div>
          )}
          {record.propertyId && (
            <div>
              <dt>Property</dt>
              <dd>{record.propertyId}</dd>
            </div>
          )}
        </dl>
      )}
    </figure>
  );
}
