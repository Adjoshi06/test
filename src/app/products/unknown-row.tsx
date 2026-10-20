// An unknown as the product page shows it: not-found is absence of evidence,
// not evidence of absence — the row says so and names what would resolve it.

import type { UnknownPropertyView } from '@/lib/products/view';

export function UnknownRow({ item }: { item: UnknownPropertyView }) {
  return (
    <article className="unknown-row">
      <header className="unknown-head">
        <h3 className="unknown-property">{item.propertyId}</h3>
        <span className="badge badge-not-found">{item.status}</span>
      </header>
      <p className="unknown-reason">{item.reason}</p>
      <p className="unknown-resolve">
        <strong>Would resolve:</strong> {item.wouldResolve}
      </p>
    </article>
  );
}
