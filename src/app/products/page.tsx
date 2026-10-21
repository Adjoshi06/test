// Browse — the discovery view over the viewer's products. Same visibility
// rules as everything else: an unauthenticated caller gets nothing, and the
// empty state says so without implying the library is empty for everyone.

import Link from 'next/link';
import { getSessionLibrary } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const library = await getSessionLibrary();
  const products = await library.listProducts();

  return (
    <main className="shell">
      <p className="shell-eyebrow">Core evidence loop · synthetic library</p>
      <h1>Products</h1>
      <p className="shell-lede">
        Everything the library holds, per product — each value with its locator, method, authority
        and verification state; what is missing stays unknown.
      </p>
      {products.length === 0 ? (
        <p className="empty-state">
          Nothing here yet — the library holds no products for the current viewer.
        </p>
      ) : (
        <ul className="products-list">
          {products.map(({ product, valueCount }) => (
            <li key={product.id} className="product-item">
              <h2>
                <Link href={`/products/${product.slug}`}>{product.name}</Link>
              </h2>
              <p className="product-meta">
                {product.category ?? 'Uncategorised'} · {valueCount}{' '}
                {valueCount === 1 ? 'value' : 'values'} recorded
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
