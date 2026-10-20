// The scripted fake reasoner — the model behind its interface with no provider
// and no network. Deterministic: the same question returns the same draft,
// always. It exists so the loop, the checker and the harness are testable in CI
// without any provider (spec: the model behind a reasoner interface, with a
// scripted fake for tests).
//
// The fake follows the office rules it cannot otherwise honor: an unscripted
// question produces a refusal with its reason — ask and stop rather than guess.

import type { AnswerDraft, Reasoner, ReasonerInput } from './types';
import { refusalDraft } from './types';

export interface ScriptedCase {
  /** The exact question text the script answers — matched verbatim. */
  question: string;
  /** The draft to propose. Its claims must reference records the library search returns (contract-tested). */
  draft: AnswerDraft;
}

export class FakeReasoner implements Reasoner {
  readonly name = 'fake-reasoner';

  private readonly byQuestion: ReadonlyMap<string, AnswerDraft>;

  constructor(script: readonly ScriptedCase[]) {
    this.byQuestion = new Map(script.map((entry) => [entry.question, entry.draft]));
  }

  async answer({ question }: ReasonerInput): Promise<AnswerDraft> {
    const scripted = this.byQuestion.get(question);
    if (scripted !== undefined) return scripted;
    return refuseUnscripted(question);
  }
}

function refuseUnscripted(question: string): AnswerDraft {
  return refusalDraft(
    question,
    {
      status: 'not-found',
      reason:
        'The scripted reasoner holds no answer for this question — refusing instead of guessing.',
    },
    [
      {
        propertyId: '*',
        status: 'not-found',
        reason: 'No scripted support for this question; the fake reasoner proposes nothing.',
        wouldResolve: 'Add a ScriptedCase for this question, or run the real reasoner.',
      },
    ]
  );
}
