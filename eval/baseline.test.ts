// Baseline staleness gate — the base side of the CI comparison must describe
// the case set that CI actually runs. A stale baseline does not fail the
// compare (a growing case set is not a regression), it silently weakens the
// base side and the per-question report stops meaning anything. This test
// fails when the committed baseline and the case file drift apart, and the
// message carries the regeneration command.
//
// If this test fails: the case set changed without a re-baseline. Re-run
//
//   npm run -s eval:run -- --out=eval/baseline.json
//
// and commit the refreshed baseline with your change.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadCases } from './cases';
import { parseHarnessResults, parseCaseFile } from './schema';

const BASELINE_PATH = 'eval/baseline.json';
const CASES_PATH = 'eval/cases/core-loop.cases.json';

describe('the committed baseline', () => {
  it('describes the current case set — re-baseline when the case set changes', async () => {
    const cases = await loadCases();

    // Parse from raw bytes so a malformed or hand-edited baseline fails loudly
    // here rather than inside the compare.
    const baseline = parseHarnessResults(
      JSON.parse(readFileSync(BASELINE_PATH, 'utf8')),
      BASELINE_PATH
    );
    parseCaseFile(JSON.parse(readFileSync(CASES_PATH, 'utf8')), CASES_PATH);

    expect(baseline.harnessVersion).toBe(1);
    expect(baseline.engine).toBe('scripted-stub');

    const baselineIds = baseline.cases.map((entry) => entry.caseId).sort();
    const caseIds = cases.map((entry) => entry.id).sort();
    expect(
      baselineIds,
      'baseline case ids drifted from the case file — re-run: npm run -s eval:run -- --out=eval/baseline.json'
    ).toEqual(caseIds);
  });
});
