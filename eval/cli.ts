// Harness CLI.
//   tsx eval/cli.ts run [--out=<path>]               run the case set, write results JSON
//   tsx eval/cli.ts compare <base.json> <head.json>  base-vs-head per-question report
//
// run exits 1 when any case fails — a baseline may not be minted from a red run.
// compare exits 1 on any regression — CI gates on this.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { compareResults, formatReport, hasRegressions } from './compare';
import { ScriptedEngine } from './engine';
import { SCRIPTED_ANSWERS, SCRIPTED_LIBRARY } from './fixtures';
import { runHarness } from './run';
import { CaseParseError, parseCaseFile, parseHarnessResults } from './schema';
import type { EvalCase } from './schema';

const CASES_DIR = 'eval/cases';

async function loadCases(dir: string): Promise<EvalCase[]> {
  const files = (await readdir(dir)).filter((name) => name.endsWith('.cases.json')).sort();
  const cases: EvalCase[] = [];
  for (const file of files) {
    const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
    cases.push(...parseCaseFile(raw, file));
  }
  return cases;
}

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
  const cases = await loadCases(CASES_DIR);
  const engine = new ScriptedEngine(SCRIPTED_ANSWERS);
  const results = runHarness(
    cases,
    (question) => engine.answer(question),
    (recordId) => SCRIPTED_LIBRARY[recordId]
  );

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

  const target = outPath ?? '.eval/results.json';
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
  if (command === 'compare') {
    const basePath = positional[1];
    const headPath = positional[2];
    if (basePath === undefined || headPath === undefined) {
      console.error('usage: tsx eval/cli.ts compare <base.json> <head.json>');
      return 2;
    }
    return compare(basePath, headPath);
  }
  console.error('usage: tsx eval/cli.ts run [--out=<path>] | compare <base.json> <head.json>');
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
