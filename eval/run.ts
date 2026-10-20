// Runs the case set through the engine and grades every case against the five
// standing questions. Deterministic: sorted case order, stable key order, no
// timestamps — byte-identical results for identical behavior.

import { gradeCase } from './grader';
import type {
  AnswerDraft,
  CaseResult,
  EvalCase,
  HarnessResults,
  QuestionSummary,
  ResolveRecord,
  StandingQuestionId,
} from './schema';
import { STANDING_QUESTIONS } from './schema';

export const HARNESS_VERSION = 1 as const;
export const ENGINE_NAME = 'scripted-stub';

export function runHarness(
  cases: readonly EvalCase[],
  answer: (question: string) => AnswerDraft,
  resolveRecord: ResolveRecord
): HarnessResults {
  const caseResults: CaseResult[] = [...cases]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((evalCase) => gradeCase(evalCase, answer(evalCase.question), resolveRecord));

  const perQuestion = Object.fromEntries(
    STANDING_QUESTIONS.map((question) => [question, { passed: 0, failed: 0 }])
  ) as Record<StandingQuestionId, QuestionSummary>;
  for (const result of caseResults) {
    for (const question of STANDING_QUESTIONS) {
      const key = result.questions[question].verdict === 'pass' ? 'passed' : 'failed';
      perQuestion[question][key] += 1;
    }
  }

  return {
    harnessVersion: HARNESS_VERSION,
    engine: ENGINE_NAME,
    perQuestion,
    cases: caseResults,
    allPassed: caseResults.every((result) => result.passed),
  };
}
