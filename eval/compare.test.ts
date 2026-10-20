import { describe, expect, it } from 'vitest';
import { compareResults, hasRegressions } from './compare';
import type { CaseResult, HarnessResults, StandingQuestionId } from './schema';
import { STANDING_QUESTIONS } from './schema';

const passingQuestions = () =>
  Object.fromEntries(
    STANDING_QUESTIONS.map((question) => [question, { verdict: 'pass' as const, reason: 'ok' }])
  ) as Record<StandingQuestionId, { verdict: 'pass' | 'fail'; reason: string }>;

const passingCase = (caseId: string): CaseResult => ({
  caseId,
  outcome: 'answer',
  passed: true,
  questions: passingQuestions(),
});

const results = (
  failedByQuestion: Partial<Record<StandingQuestionId, number>>,
  cases: CaseResult[] = []
): HarnessResults => ({
  harnessVersion: 1,
  engine: 'scripted-stub',
  perQuestion: Object.fromEntries(
    STANDING_QUESTIONS.map((question) => [
      question,
      { passed: failedByQuestion[question] ? 0 : 1, failed: failedByQuestion[question] ?? 0 },
    ])
  ) as HarnessResults['perQuestion'],
  cases,
  allPassed: false,
});

describe('compareResults', () => {
  it('flags a regression when a passing question starts failing', () => {
    const report = compareResults(results({}), results({ candidates: 1 }));
    expect(report.regressions).toEqual(['candidates']);
    expect(hasRegressions(report)).toBe(true);
  });

  it('treats a failing question starting to pass as an improvement, not a regression', () => {
    const report = compareResults(results({ 'unknown-honesty': 1 }), results({}));
    expect(report.regressions).toEqual([]);
    expect(report.improvements).toEqual(['unknown-honesty']);
    expect(hasRegressions(report)).toBe(false);
  });

  it('reports no regressions for identical results', () => {
    const report = compareResults(results({}), results({}));
    expect(report.regressions).toEqual([]);
    expect(hasRegressions(report)).toBe(false);
  });

  it('flags a case that passed at base and fails at head', () => {
    const headCase: CaseResult = { ...passingCase('tc-1'), passed: false };
    const report = compareResults(results({}, [passingCase('tc-1')]), results({}, [headCase]));
    expect(report.caseRegressions).toEqual(['tc-1']);
    expect(hasRegressions(report)).toBe(true);
  });

  it('flags an engine change between base and head', () => {
    const report = compareResults(
      { ...results({}), engine: 'scripted-stub' },
      { ...results({}), engine: 'real-provider' }
    );
    expect(report.engineMismatch).toBe(true);
    expect(hasRegressions(report)).toBe(true);
  });
});
