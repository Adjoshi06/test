import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite loads its Postgres WASM bundle and virtual filesystem at runtime;
  // webpack's server bundle mangles that (fs receives a URL where it needs a
  // path). Run it unbundled from node_modules.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
