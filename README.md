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

## Eval harness

Cases live in `eval/cases/*.cases.json`, written in the office's own words. The scripted engine
answers without provider calls (unscripted questions refuse instead of guessing); the
deterministic grader scores five standing questions — candidates, traceability, unknown-honesty,
verification-honesty, clarify-not-guess.

- `npm run eval:run -- --out=eval/baseline.json` regenerates the baseline.
- CI runs the harness and compares head against the committed `eval/baseline.json`; any standing
  question that passed at base and fails at head fails CI.
- Update the baseline only deliberately, in the commit that changes behavior — every change must
  move at least one standing question.
- All fixtures and the baseline are synthetic (locked decision in the spec).

## Conventions

- Conventional commits, authored as `Obvious <obvious@obvious.ai>` with a
  `Co-authored-by: Aditya Joshi <adjoshi.06@gmail.com>` trailer.
- PRs target `release/core-loop`; main is merged only by a human at release time.
