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
        authority and verification state. Or <Link href="/answer">open the answer interface</Link> —
        the six-part answer, question-backs and refusals, rendered from checker output (scripted
        demo).
      </p>
      <p className="shell-status">
        Library, product pages, firm sign-in, and the answering loop are in this release. The
        seeded library is synthetic.
      </p>
    </main>
  );
}
