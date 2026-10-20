import { siteConfig } from '@/lib/site';

export default function HomePage() {
  return (
    <main className="shell">
      <p className="shell-eyebrow">Core evidence loop — scaffold</p>
      <h1>{siteConfig.name}</h1>
      <p className="shell-lede">{siteConfig.description}</p>
      <ul className="shell-notes">
        <li>The model reasons and proposes; the assertion checker asserts.</li>
        <li>Every value resolves to a place in a source document.</li>
        <li>What the sources cannot support stays unknown.</li>
      </ul>
      <p className="shell-status">
        App shell only — the answering loop, library, and product pages land in subsequent PRs.
      </p>
    </main>
  );
}
