// The product page — the answer contract with no question: everything known
// about the product, every value carrying its locator, method, authority and
// verification state, and every unknown with what would resolve it. Renders
// through the viewer-scoped library service only; nothing here is a model.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { UnknownRow } from '@/app/products/unknown-row';
import { ValueCard } from '@/app/products/value-card';
import { getSessionLibrary } from '@/lib/session';
import { buildProductView } from '@/lib/products/view';

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const library = await getSessionLibrary();
  const detail = await library.getProduct(slug);
  if (detail === null) {
    notFound();
  }
  const view = buildProductView(
    detail.product,
    detail.values,
    await library.listLibraryProperties()
  );

  return (
    <main className="shell">
      <p className="shell-eyebrow">
        <Link href="/products">Products</Link> · synthetic library
      </p>
      <h1>{view.name}</h1>
      <p className="shell-lede">
        {view.category ?? 'Uncategorised'} · <code>{view.slug}</code> — every value below resolves
        to a place in a source document; what the library cannot support stays unknown.
      </p>

      <section className="page-section" aria-labelledby="known-heading">
        <h2 id="known-heading">
          Known <span className="count">{view.known.length}</span>
        </h2>
        {view.known.length === 0 ? (
          <p className="empty-state">
            No value about this product is recorded in the library — nothing is asserted.
          </p>
        ) : (
          <div className="value-list">
            {view.known.map((value) => (
              <ValueCard
                key={`${value.propertyId}-${value.evidence.documentId}-${value.evidence.locator}`}
                value={value}
              />
            ))}
          </div>
        )}
      </section>

      <section className="page-section" aria-labelledby="unknown-heading">
        <h2 id="unknown-heading">
          Unknown <span className="count">{view.unknowns.length}</span>
        </h2>
        <p className="section-note">
          Not found is absence of evidence, not evidence of absence — each row names what would
          resolve it.
        </p>
        <div className="unknown-list">
          {view.unknowns.map((item) => (
            <UnknownRow key={item.propertyId} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
