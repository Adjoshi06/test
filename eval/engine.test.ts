import { describe, expect, it } from 'vitest';
import { ScriptedEngine } from './engine';
import { SCRIPTED_ANSWERS } from './fixtures';

describe('ScriptedEngine', () => {
  it('returns the scripted draft for a scripted question', () => {
    const engine = new ScriptedEngine(SCRIPTED_ANSWERS);
    expect(engine.answer('show me task chairs').outcome).toBe('answer');
  });

  it('refuses an unscripted question with its reason instead of guessing', () => {
    const engine = new ScriptedEngine(SCRIPTED_ANSWERS);
    const draft = engine.answer('what is the fire rating of the Vind chair?');
    expect(draft.outcome).toBe('refuse');
    expect(draft.unknowns?.[0]?.reason).toContain('No scripted support');
  });
});
