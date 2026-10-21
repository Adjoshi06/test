// Loading the case set — one definition of which files are cases and how they
// parse, shared by the CLI, the tests, and the baseline-staleness gate.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCaseFile } from './schema';
import type { EvalCase } from './schema';

export const CASES_DIR = 'eval/cases';

/** Load every *.cases.json file in `dir`, sorted by filename for determinism. */
export async function loadCases(dir: string = CASES_DIR): Promise<EvalCase[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.cases.json')).sort();
  const cases: EvalCase[] = [];
  for (const file of files) {
    const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
    cases.push(...parseCaseFile(raw, file));
  }
  return cases;
}
