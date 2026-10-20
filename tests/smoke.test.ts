import { describe, expect, it } from 'vitest';
import { siteConfig } from '@/lib/site';

// Scaffold smoke test: the app module graph resolves through the @/ alias —
// the root layout and home page import their metadata from here.
describe('app shell', () => {
  it('exposes the site metadata the root layout consumes', () => {
    expect(siteConfig.name).toBe('Product Selection Assistant');
    expect(siteConfig.description).toContain('traceable');
  });
});
