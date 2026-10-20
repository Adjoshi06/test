'use client';

// The answer interface's scripted harness — a demo surface, clearly labeled.
// It runs one honest loop in the browser: the scripted reasoner proposes, the
// real assertion checker assembles, and the answer view renders only the
// CheckedAnswer that comes back. Editing the interpretation re-runs the loop
// with the edited reading as the question; the scripted engine answers what it
// holds and refuses the rest.

import { useCallback, useEffect, useState } from 'react';
import { AnswerView } from '@/components/answer/AnswerView';
import type { InterpretationEdit } from '@/components/answer/InterpretationPanel';
import { DEMO_QUESTIONS, runDemoLoop } from '@/demo/answer-demo';
import type { CheckedAnswer } from '@/lib/checker/types';
import { siteConfig } from '@/lib/site';

type Scenario = 'answer' | 'clarify' | 'refusal';

const SCENARIOS: readonly { key: Scenario; label: string }[] = [
  { key: 'answer', label: 'An answer' },
  { key: 'clarify', label: 'A question back' },
  { key: 'refusal', label: 'A refusal' },
];

export default function AnswerDemoPage() {
  const [answer, setAnswer] = useState<CheckedAnswer | null>(null);
  const [asked, setAsked] = useState<string>(DEMO_QUESTIONS.answer);

  const run = useCallback((q: string) => {
    void runDemoLoop(q).then((checked) => {
      setAsked(q);
      setAnswer(checked);
    });
  }, []);

  useEffect(() => {
    run(DEMO_QUESTIONS.answer);
  }, [run]);

  const onInterpretationEdit = useCallback(
    (edit: InterpretationEdit) => {
      // The scripted engine takes the corrected reading as its question — an
      // unscripted reading refuses, ask-rather-than-guess, through the checker.
      run(edit.statement);
    },
    [run]
  );

  return (
    <main className="shell answer-page">
      <p className="shell-eyebrow">Core evidence loop — answer interface</p>
      <h1>{siteConfig.name}</h1>
      <p className="shell-lede">
        The model reasons and never asserts: every value below was assembled by the assertion
        checker from library records, and everything the sources cannot support stays unknown.
      </p>

      <div className="scenario-bar" role="group" aria-label="Scripted scenarios">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.key}
            type="button"
            className={`button chip${asked === DEMO_QUESTIONS[scenario.key] ? ' active' : ''}`}
            onClick={() => run(DEMO_QUESTIONS[scenario.key])}
          >
            {scenario.label}
          </button>
        ))}
      </div>
      <p className="asked-question">
        Asked: <span className="asked-text">{asked}</span>
      </p>

      {answer === null ? (
        <p className="shell-status">Running the loop…</p>
      ) : (
        <AnswerView
          answer={answer}
          onInterpretationEdit={onInterpretationEdit}
          onReadingChosen={run}
        />
      )}

      <p className="shell-status">
        Scripted demo — the reasoner here is the deterministic fake; the checker is the real one.
        Editing the interpretation re-runs the loop, and an unscripted reading refuses rather than
        guesses.
      </p>
    </main>
  );
}
