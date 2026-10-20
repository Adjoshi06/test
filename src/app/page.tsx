import Link from 'next/link';
import { siteConfig } from '@/lib/site';

export default function HomePage() {
  return (
    <main className="shell">
      <p className="shell-eyebrow">Core evidence loop</p>
      <h1>{siteConfig.name}</h1>
      <p className="shell-lede">{siteConfig.description}</p>
      <ul className="shell-notes">
        <li>The model reasons and proposes; the assertion checker asserts.</li>
        <li>Every value resolves to a place in a source document.</li>
        <li>What the sources cannot support stays unknown.</li>
      </ul>
      <p>
        <Link href="/products">Browse products</Link> — every value with its locator, method,
        authority and verification state.
      </p>
      <p className="shell-status">
        Library and product pages are in; the answering loop lands in a subsequent PR. The seeded
        library is synthetic.
      </p>
    </main>
  );
}
