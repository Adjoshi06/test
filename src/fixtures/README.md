# Synthetic fixture corpus

**Everything in this directory is fabricated.** Every product, manufacturer,
document, quote, report number, certificate, standard value and person here is
invented for development, demonstration and evaluation. No real manufacturer
data exists in this repository.

- **Products** are invented (Halden, Vind, Mera, Lume, Fjell, …). Any resemblance
  to a real product line is coincidental.
- **Documents** quote synthetic text. Locators (page, section, message) are
  realistic in _shape_ so the evidence contract is exercised, but they address
  nothing real.
- **Standards are cited for realism only** (EN 13501-1, ASTM E84, LM-79, DIN
  51130, …). The values recorded under them do not represent real test results
  and must never be quoted as such. The methods registry (`src/lib/registry`)
  carries the real classification systems; this corpus carries made-up values.
- **People** sit on the reserved `.test` TLD (`demo@studio.test`,
  `lead@studio.test`).
- Every document title carries the marker `(synthetic fixture)`, and
  `validateCorpus` refuses to seed a corpus whose titles lose that marker.

## What the corpus contains

| Family   | Products                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| Seating  | Halden task chair, Vind desk chair, Mera conference chair, Skala counter stool, Bram lounge chair, Tove visitor chair |
| Lighting | Lume pendant, Kestrel linear, Noct downlight, Aery floor lamp                                                         |
| Tile     | Verre ceramic, Basalt porcelain, Kaolin glass mosaic, Terra terracotta                                                |
| Ceilings | Fjell mineral panel, Vela metal raft, Hull acoustic baffle, Prism suspended tile                                      |

plus four code excerpts (US / IBC 2018 & 2024, UK / Approved Document B 2019 &
2026 — two jurisdictions × two editions), two project briefs, the firm
materials standard, and three correspondence threads: 28 documents in all.

## Deliberate structure (the eval harness leans on these)

- **Comparable-method pair** — Fjell classifies fire under `en-13501-1:2018`,
  Vela's scanned datasheet under `en-13501-1:2007`; the registry marks the two
  editions comparable.
- **Known-incomparable pairs** — Basalt carries `astm-e84` and
  `en-13501-1:2018` fire values (registry: not comparable); Terra/Hull carry
  two slip (or absorption) methods with no edge between them.
- **Authority conflict** — Approved Document B 2019 requires `Cfl-s2 or
better` for floor linings; the firm standard treats `Cfl-s3` as acceptable
  in enclosed wet rooms (`floor-fire-requirement` under `code` **and**
  `project` authority). Firm knowledge may add requirements, never relax a
  code — the checker shows the conflict, it does not blend it.
- **Deliberate gaps** (`DELIBERATE_GAPS` in `corpus/index.ts`) — properties a
  product genuinely lacks (Halden and Vind have no fire data at all; the
  Halden correspondence thread documents the pending certificate).
- **One adversarial property** (`ADVERSARIAL_PROPERTIES`) —
  `antimicrobial-coating` appears nowhere in the corpus; questions about it
  must end in unknown, and the integrity tests prove its absence.
- **All three verification states** — human-verified (named verifier),
  interpreted, machine-read (a scanned page with an OCR locator).

## Seeding

```ts
import { createDb } from '@/db/client';
import { runMigrations } from '@/db/migrate';
import { seedFixtureCorpus } from '@/fixtures/loader';

const db = createDb(); // or a server driver
await runMigrations(db);
const summary = await seedFixtureCorpus(db);
// → { documentCount: 28, passageCount: N, valueCount: N, … }
```

The loader seeds a fresh, migrated database through the real services and
refuses to double-seed. `validateCorpus` is the pure gate: tests and the
loader share one definition of a sound corpus.
