// A known value as the product page shows it: the value with its verification
// state, and its evidence one click away — document, locator, verbatim quote.

import type { KnownValueView } from '@/lib/products/view';
import {
  authorityLabel,
  documentKindLabel,
  verificationBadge,
  verificationLabel,
} from '@/lib/products/view';

export function ValueCard({ value }: { value: KnownValueView }) {
  const jurisdictionEdition =
    value.evidence.documentJurisdiction !== null && value.evidence.documentEdition !== null
      ? ` — ${value.evidence.documentJurisdiction} ${value.evidence.documentEdition}`
      : '';
  return (
    <article className="value-card">
      <header className="value-card-head">
        <h3 className="value-property">{value.propertyId}</h3>
        <span className={`badge badge-${value.verification}`}>
          {verificationBadge(value.verification)}
        </span>
      </header>
      <p className="value-raw">&ldquo;{value.raw}&rdquo;</p>
      <p className="value-meta">
        method <code>{value.methodId}</code> · authority {authorityLabel(value.authority)} ·{' '}
        <span className={`state-${value.verification}`}>
          {verificationLabel(value.verification, value.verifiedByName)}
        </span>{' '}
        · recorded {value.recordedOn}
      </p>
      <details className="evidence">
        <summary>
          Evidence — {value.evidence.documentTitle}
          {jurisdictionEdition} · {value.evidence.locator}
        </summary>
        <blockquote className="evidence-quote">{value.evidence.quote}</blockquote>
        <p className="evidence-meta">
          {documentKindLabel(value.evidence.documentKind)} · {value.evidence.locator}
        </p>
      </details>
    </article>
  );
}
