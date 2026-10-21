// @vitest-environment jsdom

// Component tests for the answer UI. The fixtures come through the real
// assertion checker (the demo library runs each scripted draft through
// assembleAnswer), so what the tests assert is what checker output renders —
// including the standing-question-4 rule that an unverified value must never
// look checked.

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AnswerView } from './AnswerView';
import { buildDemoFixtures } from '@/demo/answer-demo';
import type { CheckedAnswer } from '@/lib/checker/types';

afterEach(cleanup);

/** getAllByRole indexing yields `HTMLElement | undefined` under noUncheckedIndexedAccess. */
function required(element: HTMLElement | undefined | null): HTMLElement {
  if (element === undefined || element === null) throw new Error('expected an element');
  return element;
}

let answer: CheckedAnswer;
let clarify: CheckedAnswer;
let refusal: CheckedAnswer;

beforeAll(async () => {
  const fixtures = await buildDemoFixtures();
  answer = fixtures.answer;
  clarify = fixtures.clarify;
  refusal = fixtures.refusal;
});

describe('AnswerView — the answer outcome, all six parts', () => {
  it('renders part 01 — what was understood, with the assistant marks', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: 'What the assistant understood' });
    expect(within(part).getByText(/the assistant’s reading — editable/)).toBeTruthy();
    expect(
      within(part).getByText(
        /Task chairs for the studio — seat height adjustable, lumbar support, black finish, and code-compliant on flame spread\./
      )
    ).toBeTruthy();
    // The lay term is translated explicitly, and the inference is marked.
    expect(part.textContent).toContain('“ergonomic” → adjustable seat height + lumbar support');
    expect(within(part).getByText('translated')).toBeTruthy();
    expect(within(part).getByText(/seated desk work/)).toBeTruthy();
    expect(within(part).getByText('inferred')).toBeTruthy();
  });

  it('renders part 02 — requirements applied, each with its source', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: 'Requirements applied' });
    expect(within(part).getByText('Seat height adjustable')).toBeTruthy();
    expect(within(part).getByText('Lumbar support')).toBeTruthy();
    expect(within(part).getByText('Available in black')).toBeTruthy();
    expect(within(part).getByText('Interior finish flame-spread Class A')).toBeTruthy();
    // Where each requirement came from.
    expect(within(part).getByText('[you]')).toBeTruthy();
    expect(within(part).getByText('[project Studio brief, 12 Feb, p. 3]')).toBeTruthy();
    expect(within(part).getByText('[code — binds IBC 2024 §10.3.2]')).toBeTruthy();
    expect(within(part).getByText('[assistant ✱ from “ergonomic”]')).toBeTruthy();
  });

  it('renders part 03 — the candidate matrix with meet, fail, and unknown', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: 'Candidates by requirement' });
    expect(within(part).getByText('halden-task-chair')).toBeTruthy();
    expect(within(part).getByText('mera-conference-chair')).toBeTruthy();
    expect(within(part).getByText('vind-desk-chair')).toBeTruthy();
    // Verdicts are computed words with reasons, across all three shapes.
    expect(within(part).getAllByText('meets').length).toBeGreaterThan(0);
    expect(within(part).getAllByText('fails').length).toBeGreaterThan(0);
    expect(within(part).getAllByText('unknown').length).toBeGreaterThan(0);
    // Every cell carries its computed reason beside the verdict.
    expect(part.querySelectorAll('.cell-reason').length).toBeGreaterThan(0);
  });

  it('renders part 04 — commentary visibly separated from the evidence', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: "The assistant's judgment" });
    expect(within(part).getByText(/not evidence/)).toBeTruthy();
    expect(within(part).getByText(/fits the brief best on what the library holds/)).toBeTruthy();
    expect(
      within(part).getByText(/code compliance is unknown — not met, and not failed/)
    ).toBeTruthy();
  });

  it('renders part 05 — unknowns with what would resolve them, both kinds distinct', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: 'What is unknown' });
    // The two search outcomes stay distinct.
    expect(within(part).getByText('Not found — a search ran and found none')).toBeTruthy();
    expect(within(part).getByText('Search failed — the search did not complete')).toBeTruthy();
    expect(
      within(part).getByText(
        /No fire classification for Halden exists in the library — a full search found none\./
      )
    ).toBeTruthy();
    expect(
      within(part).getByText(
        /would resolve: The manufacturer’s fire certificate \(an EN 13501-1 or ASTM E84 class\)\./
      )
    ).toBeTruthy();
    expect(
      within(part).getByText(/would resolve: A retry — the search re-runs when the index answers\./)
    ).toBeTruthy();
  });

  it('renders part 06 — sources, one step from the answer', () => {
    render(<AnswerView answer={answer} />);
    const part = screen.getByRole('region', { name: 'Sources' });
    // Every record the checker attached, each one openable.
    expect(within(part).getAllByRole('button', { name: /Open evidence for/ }).length).toBe(
      answer.evidence.length
    );
    expect(
      within(part).getAllByText(/Halden task chair — technical specification \(synthetic fixture\)/)
        .length
    ).toBeGreaterThan(0);
    expect(
      within(part).getByText(/Correspondence — Mera studio rep, 14 Mar \(synthetic fixture\)/)
    ).toBeTruthy();
  });
});

describe('AnswerView — verification states (standing question 4)', () => {
  it('shows a human-verified record as checked, with who verified it', () => {
    const { container } = render(<AnswerView answer={answer} />);
    const checkedBadges = container.querySelectorAll('[data-checked="true"]');
    expect(checkedBadges.length).toBeGreaterThan(0);
    for (const badge of checkedBadges) {
      expect(badge.classList.contains('badge-verified')).toBe(true);
      expect(badge.textContent).toMatch(/Verified by M\. Okafor/);
    }
  });

  it('never styles an interpreted or machine-read value as checked', () => {
    const { container } = render(<AnswerView answer={answer} />);
    const unchecked = container.querySelectorAll('[data-checked="false"]');
    expect(unchecked.length).toBeGreaterThan(0);
    for (const badge of unchecked) {
      expect(badge.classList.contains('badge-verified')).toBe(false);
    }
    // Both unverified states say so in words, in their own badge style.
    expect(screen.getAllByText('Read from the source — not yet checked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Extracted from the document').length).toBeGreaterThan(0);
  });
});

describe('AnswerView — the evidence drawer', () => {
  it('opens from a matrix cell and shows the full record, closes on Escape', async () => {
    const user = userEvent.setup();
    render(<AnswerView answer={answer} />);
    // The Halden row's first cell (seat height) carries one attached record.
    const matrix = screen.getByRole('region', { name: 'Candidates by requirement' });
    const haldenRow = within(matrix).getByText('halden-task-chair').closest('tr');
    expect(haldenRow).not.toBeNull();
    const cellButtons = within(haldenRow as HTMLElement).getAllByRole('button', {
      name: /one click away/,
    });
    await user.click(required(cellButtons[0]));
    const drawer = screen.getByRole('dialog', { name: 'Evidence' });
    expect(
      within(drawer).getByText(/Halden task chair — technical specification \(synthetic fixture\)/)
    ).toBeTruthy();
    expect(within(drawer).getByText(/p\. 4, §2\.1/)).toBeTruthy();
    expect(within(drawer).getByText('Seat height adjustable 42–55 cm via gas lift.')).toBeTruthy();
    expect(within(drawer).getByText('product documentation')).toBeTruthy();
    expect(within(drawer).getByText(/Verified by M\. Okafor/)).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Evidence' })).toBeNull();
  });

  it('opens from the sources list', async () => {
    const user = userEvent.setup();
    render(<AnswerView answer={answer} />);
    await user.click(
      screen.getByRole('button', {
        name: 'Open evidence for Mera conference chair — product sheet (synthetic fixture), p. 2, §1.4',
      })
    );
    const drawer = screen.getByRole('dialog', { name: 'Evidence' });
    expect(within(drawer).getByText('Standard finish: White.')).toBeTruthy();
    expect(within(drawer).getByText('Extracted from the document')).toBeTruthy();
  });

  it('opens both sides of a disagreement from the conflict row', async () => {
    const user = userEvent.setup();
    render(<AnswerView answer={answer} />);
    await user.click(
      screen.getByRole('button', { name: /2 disagreeing records — one click away/ })
    );
    const drawer = screen.getByRole('dialog', { name: 'Evidence' });
    // Both records, neither blended: the sheet and the rep's correction.
    expect(
      within(drawer).getByText(/Mera conference chair — product sheet \(synthetic fixture\)/)
    ).toBeTruthy();
    expect(
      within(drawer).getByText(/Correspondence — Mera studio rep, 14 Mar \(synthetic fixture\)/)
    ).toBeTruthy();
  });
});

describe('AnswerView — the question-back outcome', () => {
  it('names the ambiguity and each reading with what it would change — and no matrix', () => {
    render(<AnswerView answer={clarify} />);
    expect(
      screen.getByText(
        /“Soundproof” can name three different needs — the library treats them as different products, rated by different methods\./
      )
    ).toBeTruthy();
    expect(screen.getByText('Absorption inside the room — acoustic panels')).toBeTruthy();
    expect(screen.getByText('Blocking sound leaving the room — a partition')).toBeTruthy();
    expect(screen.getByText('Impact noise from the suite above — a floor assembly')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Candidates by requirement' })).toBeNull();
    expect(screen.queryByRole('region', { name: "The assistant's judgment" })).toBeNull();
  });

  it('re-runs the loop when a reading is chosen', async () => {
    const onReadingChosen = vi.fn();
    const user = userEvent.setup();
    render(<AnswerView answer={clarify} onReadingChosen={onReadingChosen} />);
    const readingButtons = screen.getAllByRole('button', { name: /Answer for this reading/ });
    await user.click(required(readingButtons[1]));
    expect(onReadingChosen).toHaveBeenCalledWith('Blocking sound leaving the room — a partition');
  });
});

describe('AnswerView — the refusal outcome', () => {
  it('states plainly that there is no answer and why', () => {
    render(<AnswerView answer={refusal} />);
    // The status headline appears on the panel and on the unknown row beneath it.
    expect(screen.getAllByText('Not found — a search ran and found none').length).toBe(2);
    expect(
      screen.getByText(
        /The library holds specifications, not judgments — “best” is a fit assessment the sources cannot support\./
      )
    ).toBeTruthy();
    // The refusal's own unknown, with what would resolve it.
    expect(screen.getByText('The whole question')).toBeTruthy();
    expect(
      screen.getByText(/No recorded ranking exists — the library records values, not verdicts\./)
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Candidates by requirement' })).toBeNull();
  });
});

describe('AnswerView — editing the interpretation re-runs the loop', () => {
  it('saves the edited statement, translations, and inferred needs upstream', async () => {
    const onInterpretationEdit = vi.fn();
    const user = userEvent.setup();
    render(<AnswerView answer={answer} onInterpretationEdit={onInterpretationEdit} />);
    await user.click(screen.getByRole('button', { name: 'Edit this reading' }));
    const statement = screen.getByLabelText('The reading, in your terms');
    await user.clear(statement);
    await user.type(statement, 'seating for a design studio');
    await user.click(screen.getByRole('button', { name: 'Re-run with this reading' }));
    expect(onInterpretationEdit).toHaveBeenCalledWith(
      expect.objectContaining({ statement: 'seating for a design studio' })
    );
  });
});
