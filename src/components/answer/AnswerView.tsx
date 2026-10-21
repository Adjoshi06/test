'use client';

// The answer view — the six-part contract rendered from the assertion checker's
// CheckedAnswer and nothing else. Three outcomes, three renderings: an answer
// shows all six parts; a question back names the ambiguity and its readings and
// answers nothing until a reading is chosen; a refusal states plainly why the
// sources cannot support an answer. This component owns the evidence drawer's
// open state so every value in every part is one click from its record.

import { useEffect, useMemo, useState } from 'react';
import type { CheckedAnswer } from '@/lib/checker/types';
import { CandidateMatrix } from './CandidateMatrix';
import { CommentaryPanel } from './CommentaryPanel';
import { ConflictsPanel } from './ConflictsPanel';
import { EvidenceRecordCard } from './EvidenceRecordCard';
import { InterpretationPanel, type InterpretationEdit } from './InterpretationPanel';
import { QuestionBackPanel } from './QuestionBackPanel';
import { RefusalPanel } from './RefusalPanel';
import { RequirementsPanel } from './RequirementsPanel';
import { SourcesPanel } from './SourcesPanel';
import { UnknownsPanel } from './UnknownsPanel';

export interface AnswerViewProps {
  answer: CheckedAnswer;
  /** Saving an edited reading re-runs the loop upstream. Absent: read-only. */
  onInterpretationEdit?: (edit: InterpretationEdit) => void;
  /** Choosing a reading of an ambiguity re-runs the loop with it. */
  onReadingChosen?: (reading: string) => void;
}

export function AnswerView({ answer, onInterpretationEdit, onReadingChosen }: AnswerViewProps) {
  const evidenceById = useMemo(
    () => new Map(answer.evidence.map((record) => [record.id, record])),
    [answer.evidence]
  );
  const [drawerRecordIds, setDrawerRecordIds] = useState<readonly string[] | null>(null);

  useEffect(() => {
    if (drawerRecordIds === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerRecordIds(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerRecordIds]);

  function openEvidence(recordIds: readonly string[]) {
    // Only records the checker attached may open — a reference the checker
    // stripped has no record to show, and the unknown row already says why.
    const resolvable = recordIds.filter((id) => evidenceById.has(id));
    if (resolvable.length === 0) return;
    setDrawerRecordIds(resolvable);
  }

  return (
    <article className="answer" data-outcome={answer.outcome}>
      <InterpretationPanel
        interpretation={
          answer.interpretation[0] ?? { statement: '', translations: [], inferredNeeds: [] }
        }
        onEdit={onInterpretationEdit}
      />

      {answer.outcome === 'answer' && (
        <>
          <RequirementsPanel requirements={answer.requirements} />
          <CandidateMatrix
            requirements={answer.requirements}
            results={answer.results}
            onOpenEvidence={openEvidence}
          />
          <ConflictsPanel
            conflicts={answer.conflicts}
            evidenceById={evidenceById}
            onOpenEvidence={openEvidence}
          />
          <CommentaryPanel commentary={answer.commentary} />
          <UnknownsPanel unknowns={answer.unknowns} onOpenEvidence={openEvidence} />
          <SourcesPanel evidence={answer.evidence} onOpenEvidence={openEvidence} />
        </>
      )}

      {answer.outcome === 'clarify' && answer.questionBack && (
        <QuestionBackPanel questionBack={answer.questionBack} onReadingChosen={onReadingChosen} />
      )}

      {answer.outcome === 'refuse' && answer.refusal && (
        <RefusalPanel
          refusal={answer.refusal}
          unknowns={answer.unknowns}
          onOpenEvidence={openEvidence}
        />
      )}

      {drawerRecordIds !== null && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerRecordIds(null)}
          role="presentation"
        >
          <div
            className="evidence-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Evidence"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <h2>Evidence ({drawerRecordIds.length})</h2>
              <button type="button" className="button" onClick={() => setDrawerRecordIds(null)}>
                Close
              </button>
            </div>
            <ul className="drawer-records">
              {drawerRecordIds.map((id) => {
                const record = evidenceById.get(id);
                return record ? (
                  <li key={id} className="drawer-record">
                    <EvidenceRecordCard record={record} />
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </div>
      )}
    </article>
  );
}
