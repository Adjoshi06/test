// Harness CLI.
//   tsx eval/cli.ts run [--out=<path>]               run the case set, write results JSON
//   tsx eval/cli.ts compare <base.json> <head.json>  base-vs-head per-question report
//   tsx eval/cli.ts provider-run [--out=<path>]      recorded real-provider run (evidence, not a gate)
//
// run exits 1 when any case fails — a baseline may not be minted from a red run.
// compare exits 1 on any regression — CI gates on this.
// provider-run exits 2 without an API key; a scripted result is never recorded
// as a provider run.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadCases } from './cases';
import { compareResults, formatReport, hasRegressions } from './compare';
import { ScriptedEngine } from './engine';
import { SCRIPTED_ANSWERS, SCRIPTED_LIBRARY } from './fixtures';
import { providerReasoner, runProviderHarness } from './provider-run';
import { runHarness } from './run';
import { CaseParseError, parseHarnessResults, type HarnessResults } from './schema';

function parseArgs(argv: readonly string[]): {
  options: Record<string, string>;
  positional: string[];
} {
  const options: Record<string, string> = {};
  const positional: string[] = [];
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        options[arg.slice(2)] = 'true';
      } else {
        options[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    } else {
      positional.push(arg);
    }
  }
  return { options, positional };
}

async function run(outPath: string | undefined): Promise<number> {
  const cases = await loadCases();
  const engine = new ScriptedEngine(SCRIPTED_ANSWERS);
  const results = await runHarness(
    cases,
    (question) => engine.answer(question),
    (recordId) => SCRIPTED_LIBRARY[recordId]
  );
  return reportAndWrite(results, outPath ?? '.eval/results.json');
}

async function providerRun(outPath: string | undefined): Promise<number> {
  const availability = providerReasoner();
  if (!availability.available) {
    console.error(`No real-provider run: ${availability.reason}`);
    console.error(
      'A scripted result is never recorded as a provider run. Set the injected secret (ANTHROPIC_API_KEY) and re-run.'
    );
    return 2;
  }
  const results = await runProviderHarness(availability.reasoner);
  return reportAndWrite(results, outPath ?? '.eval/provider-results.json');
}

async function reportAndWrite(results: HarnessResults, target: string): Promise<number> {
  for (const result of results.cases) {
    console.log(`${result.caseId} — ${result.outcome} — ${result.passed ? 'PASS' : 'FAIL'}`);
    for (const question of Object.keys(result.questions) as (keyof typeof result.questions)[]) {
      const verdict = result.questions[question];
      console.log(`  ${question}: ${verdict.verdict} — ${verdict.reason}`);
    }
  }
  console.log('');
  for (const [question, summary] of Object.entries(results.perQuestion)) {
    console.log(`${question}: ${summary.passed} passed / ${summary.failed} failed`);
  }
  console.log(
    `${results.cases.filter((result) => result.passed).length}/${results.cases.length} case(s) passing.`
  );

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`Wrote results to ${target}`);

  return results.allPassed ? 0 : 1;
}

async function compare(basePath: string, headPath: string): Promise<number> {
  const base = parseHarnessResults(JSON.parse(await readFile(basePath, 'utf8')), basePath);
  const head = parseHarnessResults(JSON.parse(await readFile(headPath, 'utf8')), headPath);
  const report = compareResults(base, head);
  console.log(formatReport(base, head, report));
  return hasRegressions(report) ? 1 : 0;
}

async function main(): Promise<number> {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const command = positional[0];
  if (command === 'run') return run(options['out']);
  if (command === 'provider-run') return providerRun(options['out']);
  if (command === 'compare') {
    const basePath = positional[1];
    const headPath = positional[2];
    if (basePath === undefined || headPath === undefined) {
      console.error('usage: tsx eval/cli.ts compare <base.json> <head.json>');
      return 2;
    }
    return compare(basePath, headPath);
  }
  console.error(
    'usage: tsx eval/cli.ts run [--out=<path>] | compare <base.json> <head.json> | provider-run [--out=<path>]'
  );
  return 2;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof CaseParseError ? error.message : error);
    process.exitCode = 1;
  });
