// Scripted engine stub — the reasoner behind its interface, with no provider
// calls. The harness runs in CI with zero network access; a real-provider
// adapter plugs in behind the same shape later (spec: the model behind a
// reasoner interface, with a scripted fake for tests).
//
// Stub behavior: exact-question lookup; an unscripted question refuses with its
// reason instead of guessing — the stub itself follows ask/stop-don't-guess.

import type { AnswerDraft } from './schema';

export class ScriptedEngine {
  constructor(private readonly script: Readonly<Record<string, AnswerDraft>>) {}

  answer(question: string): AnswerDraft {
    const scripted = this.script[question];
    if (scripted !== undefined) return scripted;
    return {
      outcome: 'refuse',
      unknowns: [
        {
          propertyId: '*',
          reason:
            'No scripted support for this question (scripted-stub); the real reasoner would search the library.',
        },
      ],
    };
  }
}
