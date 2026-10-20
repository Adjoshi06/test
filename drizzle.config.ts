import { defineConfig } from 'drizzle-kit';

// Generation is offline — it introspects src/db/schema.ts and emits SQL into
// src/db/migrations. Applying happens in tests and via `npm run db:migrate`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  strict: true,
  verbose: true,
});
