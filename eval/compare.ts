// Base-vs-head compare: a standing question that passed at base and fails at head
// is a regression. The report is per-question; the CLI exits non-zero on any
// regression, so CI fails on harness regressions from the first PR.

import type { HarnessResults, StandingQuestionId } from './schema';
import { STANDING_QUESTIONS } from './schema';

export type QuestionState = 'pass' | 'fail';
export type Change = 'regression' | 'improvement' | 'unchanged-pass' | 'unchanged-fail';

export interface QuestionRow {
  question: StandingQuestionId;
  base: QuestionState;
  head: QuestionState;
  change: Change;
}

export interface CompareReport {
  rows: QuestionRow[];
  regressions: StandingQuestionId[];
  improvements: StandingQuestionId[];
  caseRegressions: string[];
  caseCountChange: number;
  engineMismatch: boolean;
}

const questionState = (results: HarnessResults, question: StandingQuestionId): QuestionState =>
  results.perQuestion[question].failed === 0 ? 'pass' : 'fail';

export function compareResults(base: HarnessResults, head: HarnessResults): CompareReport {
  const rows: QuestionRow[] = STANDING_QUESTIONS.map((question) => {
    const baseState = questionState(base, question);
    const headState = questionState(head, question);
    const change: Change =
      baseState === 'pass' && headState === 'fail'
        ? 'regression'
        : baseState === 'fail' && headState === 'pass'
          ? 'improvement'
          : baseState === 'pass'
            ? 'unchanged-pass'
            : 'unchanged-fail';
    return { question, base: baseState, head: headState, change };
  });

  const caseRegressions = base.cases
    .filter(
      (baseCase) =>
        baseCase.passed &&
        head.cases.some((headCase) => headCase.caseId === baseCase.caseId && !headCase.passed)
    )
    .map((baseCase) => baseCase.caseId);

  return {
    rows,
    regressions: rows.filter((row) => row.change === 'regression').map((row) => row.question),
    improvements: rows.filter((row) => row.change === 'improvement').map((row) => row.question),
    caseRegressions,
    caseCountChange: head.cases.length - base.cases.length,
    engineMismatch: base.engine !== head.engine,
  };
}

export function hasRegressions(report: CompareReport): boolean {
  return (
    report.engineMismatch || report.regressions.length > 0 || report.caseRegressions.length > 0
  );
}

export function formatReport(
  base: HarnessResults,
  head: HarnessResults,
  report: CompareReport
): string {
  const lines: string[] = [];
  lines.push(
    `Base: ${base.cases.length} case(s) · Head: ${head.cases.length} case(s) · engine: ${base.engine} -> ${head.engine}`
  );
  lines.push('');
  lines.push('Standing question      base   head   change');
  for (const row of report.rows) {
    lines.push(
      `${row.question.padEnd(22)} ${row.base.padEnd(6)} ${row.head.padEnd(6)} ${row.change}`
    );
  }
  if (report.caseCountChange !== 0) {
    lines.push('');
    lines.push(
      `Case count changed by ${report.caseCountChange > 0 ? '+' : ''}${report.caseCountChange}.`
    );
  }
  lines.push('');
  if (report.engineMismatch) {
    lines.push(
      'FAIL — engine changed between base and head; re-baseline before judging regressions.'
    );
  } else if (report.regressions.length > 0) {
    lines.push(`FAIL — standing question(s) regressed: ${report.regressions.join(', ')}.`);
  } else if (report.caseRegressions.length > 0) {
    lines.push(`FAIL — case(s) regressed: ${report.caseRegressions.join(', ')}.`);
  } else {
    lines.push(
      report.improvements.length > 0
        ? `OK — no regressions (improved: ${report.improvements.join(', ')}).`
        : 'OK — no regressions.'
    );
  }
  return lines.join('\n');
}
