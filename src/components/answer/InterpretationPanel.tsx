'use client';

// Part 1 of the answer — what the assistant understood, in the user's terms.
// Everything here is the assistant's reading, marked as such and editable:
// translations and inferred needs wear their provenance visibly. Saving the
// edited reading re-runs the loop (AnswerView wires the callback to the
// orchestrating page) — the answer never just mutates in place.

import { useState } from 'react';
import type { Interpretation, LayTranslation } from '@/lib/reasoner/types';

export interface InterpretationEdit {
  statement: string;
  translations: LayTranslation[];
  inferredNeeds: string[];
}

/** One "lay term → explicit reading" line in the edit form. */
function parseTranslationLine(line: string): LayTranslation | undefined {
  const separator = line.indexOf('→');
  if (separator === -1) return undefined;
  const layTerm = line.slice(0, separator).trim();
  const explicitTerm = line.slice(separator + 1).trim();
  if (layTerm === '' || explicitTerm === '') return undefined;
  return { layTerm, explicitTerm };
}

function serializeTranslation({ layTerm, explicitTerm }: LayTranslation): string {
  return `${layTerm} → ${explicitTerm}`;
}

export function InterpretationPanel({
  interpretation,
  onEdit,
}: {
  interpretation: Interpretation;
  onEdit?: (edit: InterpretationEdit) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [statement, setStatement] = useState(interpretation.statement);
  const [translationLines, setTranslationLines] = useState(
    interpretation.translations.map(serializeTranslation).join('\n')
  );
  const [inferredNeeds, setInferredNeeds] = useState(interpretation.inferredNeeds.join('\n'));

  function startEditing() {
    setStatement(interpretation.statement);
    setTranslationLines(interpretation.translations.map(serializeTranslation).join('\n'));
    setInferredNeeds(interpretation.inferredNeeds.join('\n'));
    setEditing(true);
  }

  function save() {
    const trimmed = statement.trim();
    if (trimmed === '' || onEdit === undefined) {
      setEditing(false);
      return;
    }
    onEdit({
      statement: trimmed,
      translations: translationLines
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .map(parseTranslationLine)
        .filter((t) => t !== undefined),
      inferredNeeds: inferredNeeds
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== ''),
    });
    setEditing(false);
  }

  return (
    <section className="answer-part" data-part="1" aria-label="What the assistant understood">
      <h2 className="answer-part-title">
        <span className="answer-part-number">01</span> What the assistant understood
        <span className="answer-part-mark">✱ the assistant’s reading — editable</span>
      </h2>

      {editing ? (
        <div className="interpretation-edit">
          <label className="edit-field">
            <span className="edit-field-label">The reading, in your terms</span>
            <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} />
          </label>
          <label className="edit-field">
            <span className="edit-field-label">
              Translations, one per line — lay term → explicit reading
            </span>
            <textarea
              value={translationLines}
              onChange={(e) => setTranslationLines(e.target.value)}
              rows={2}
            />
          </label>
          <label className="edit-field">
            <span className="edit-field-label">Inferred needs, one per line</span>
            <textarea
              value={inferredNeeds}
              onChange={(e) => setInferredNeeds(e.target.value)}
              rows={2}
            />
          </label>
          <div className="edit-actions">
            <button type="button" className="button primary" onClick={save}>
              Re-run with this reading
            </button>
            <button type="button" className="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="interpretation">
          <p className="interpretation-statement">{interpretation.statement}</p>
          {interpretation.translations.length > 0 && (
            <ul className="interpretation-list" data-kind="translations">
              {interpretation.translations.map((t) => (
                <li key={`${t.layTerm} → ${t.explicitTerm}`}>
                  <span className="term-lay">“{t.layTerm}”</span> → {t.explicitTerm}{' '}
                  <span className="provenance">translated</span>
                </li>
              ))}
            </ul>
          )}
          {interpretation.inferredNeeds.length > 0 && (
            <ul className="interpretation-list" data-kind="inferred">
              {interpretation.inferredNeeds.map((need) => (
                <li key={need}>
                  {need} <span className="provenance">inferred</span>
                </li>
              ))}
            </ul>
          )}
          {onEdit !== undefined && (
            <button type="button" className="button subtle" onClick={startEditing}>
              Edit this reading
            </button>
          )}
        </div>
      )}
    </section>
  );
}
