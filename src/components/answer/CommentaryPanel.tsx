// Part 4 of the answer — the assistant's own words. Visibly separated from the
// evidence by structure and styling: this is judgment, labeled as judgment (the
// spec promise: judgment is labelled). It sits after the matrix, before the
// unknowns, and never wears evidence's clothes.

export function CommentaryPanel({ commentary }: { commentary: readonly string[] }) {
  if (commentary.length === 0) return null;
  return (
    <section className="answer-part commentary" data-part="4" aria-label="The assistant's judgment">
      <h2 className="answer-part-title">
        <span className="answer-part-number">04</span> The assistant’s judgment — not evidence
      </h2>
      {commentary.map((line) => (
        <p key={line} className="commentary-line">
          {line}
        </p>
      ))}
    </section>
  );
}
