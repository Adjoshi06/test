# Product-selection assistant (Archetype)

Evidence-grounded product selection for a design office. The model reasons and never asserts:
every value traces to a place in a source document, verification state is shown honestly, and
what the sources cannot support stays unknown. Spec: _Core evidence loop — product-selection
assistant_ (Obvious blueprint `art_Ene8eA8R`).

## Stack

Next.js (App Router) + TypeScript (strict) · Vitest · Postgres 16 + pgvector (dev, via Docker) ·
GitHub Actions CI. The reasoner sits behind an interface; the assertion checker is deterministic
TypeScript. The seeded library is synthetic.

## Development

```bash
npm ci
docker compose up -d db   # Postgres 16 + pgvector (wired up in later PRs; the shell runs without it)
npm run dev               # http://localhost:3000
```

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm run lint`         | ESLint (flat config, + Prettier) |
| `npm run format:check` | Prettier check                   |
| `npm run typecheck`    | `tsc --noEmit`                   |
| `npm run test`         | Vitest unit tests                |
| `npm run build`        | Production build                 |

## Conventions

- Conventional commits, authored as `Obvious <obvious@obvious.ai>` with a
  `Co-authored-by: Aditya Joshi <adjoshi.06@gmail.com>` trailer.
- PRs target `release/core-loop`; main is merged only by a human at release time.
