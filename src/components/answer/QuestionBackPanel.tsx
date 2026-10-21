// The question back — the ambiguity named, each reading with what choosing it
// would change, and no answer until one is chosen (spec promise: asks rather
// than guesses). Choosing a reading re-runs the loop with it; the panel itself
// renders only what the checker's outcome carries.

import type { QuestionBack } from '@/lib/reasoner/types';

export function QuestionBackPanel({
  questionBack,
  onReadingChosen,
}: {
  questionBack: QuestionBack;
  onReadingChosen?: (reading: string) => void;
}) {
  return (
    <section
      className="answer-part question-back"
      data-outcome-panel="clarify"
      aria-label="A question back"
    >
      <h2 className="answer-part-title">Before any answer — the question is ambiguous</h2>
      <p className="question-back-ambiguity">{questionBack.ambiguity}</p>
      <ul className="question-back-readings">
        {questionBack.readings.map((reading) => (
          <li key={reading.reading}>
            <p className="reading-name">{reading.reading}</p>
            <p className="reading-change">choosing it would change: {reading.whatItWouldChange}</p>
            {onReadingChosen !== undefined && (
              <button
                type="button"
                className="button"
                onClick={() => onReadingChosen(reading.reading)}
              >
                Answer for this reading
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
