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
docker compose up -d db   # Postgres 16 + pgvector (the app server wires to it in a later PR)
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
| `npm run db:generate`  | Emit a migration from the schema |
| `npm run db:migrate`   | Apply migrations locally         |

## Sign-in and visibility

Identity is resolved before anything reaches the model. `src/lib/auth/` owns it:

- **`IdentityProvider`** (`provider.ts`) — the swappable sign-in contract. This release
  ships `SeededEmailProvider` (email against the seeded firm roster); Google OAuth lands
  behind the same interface in the connectors phase.
- **`SessionService`** (`session.ts`) — opaque random session tokens (30-day expiry). Only
  the token's SHA-256 hash is stored, so a leaked database cannot mint sessions; expired
  sessions are deleted at resolution.
- **`AuthService`** (`service.ts`) — `signIn` (returns the token once), `viewerFromToken`
  (a null viewer means unauthenticated), and idempotent `signOut`.

Seeding: `npm run db:seed` upserts the synthetic default roster (`.test` addresses), or
`FIRM_USER_EMAILS=a@firm.test,b@firm.test npm run db:seed` for specific addresses.
Idempotency is by normalized email — the user id survives re-seeding, so library rows that
reference it do too.

The visibility rule is enforced at the query layer, not the UI: every library query filters
by the viewer's owner id, and an unauthenticated request (null viewer) gets an empty result
from every read and a rejection from every write. `ViewerScopedSearch`
(`src/lib/reasoner/scoped-search.ts`) is the identity gate in front of the model's one tool —
a null viewer returns nothing and the delegate search never runs.

## Database

Drizzle owns the schema and migrations. Change `src/db/schema.ts`, run
`npm run db:generate`, and commit the generated SQL under `src/db/migrations/` — never
hand-edit a migration or its snapshot. The library service (`src/lib/library/`) is the only
code path that reads or writes the library; every row carries a visibility `owner_id`, and
every query is scoped by the caller. Tests run on PGlite — in-process Postgres with the
same engine semantics (enums, checks, composite foreign keys) — so `npm test` needs no
services.

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

### Recorded provider runs (evidence, not a gate)

The scripted engine is the CI gate. Alongside it, the same case set and graders can run against
the real provider (Claude) and be recorded as evidence:

- The provider adapter reads the injected secret `ANTHROPIC_API_KEY` (`SECRET_ANTHROPIC_API_KEY`
  in the sandbox). Ask in the project thread to have it added; the run never receives a key any
  other way.
- `npm run eval:provider` runs the harness over the Claude adapter with the synthetic scripted
  library as its search fixture and writes `.eval/provider-results.json` (`engine: "claude"`).
  This measures reasoning and grading over the synthetic library — not live-corpus retrieval;
  no database-backed search exists yet.
- Without a key the command exits 2 with its reason. A scripted result is never recorded as a
  provider run.
- Review a recorded run against the baseline the same way CI does:
  `npm run eval:compare -- eval/baseline.json .eval/provider-results.json`. Divergences are
  evidence about the provider's behavior, not CI failures — the scripted gate decides.
- Committing a recorded run is deliberate: it documents what the provider did at that head, and
  the re-record procedure is exactly the two commands above.

## Conventions

- Conventional commits, authored as `Obvious <obvious@obvious.ai>` with a
  `Co-authored-by: Aditya Joshi <adjoshi.06@gmail.com>` trailer.
- PRs target `release/core-loop`; main is merged only by a human at release time.
