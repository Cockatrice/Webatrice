import { Phase } from '@cockatrice/datatrice';

import { getSettings, settingsStore } from '../../../hooks/useSettings';
import { arrowDeleteInPhase, arrowLifetime } from './arrowLifetime';

describe('arrowDeleteInPhase', () => {
  it('keeps an arrow until the phase after its group, as desktop does', () => {
    expect(arrowDeleteInPhase(Phase.Untap, true)).toBe(Phase.FirstMain);
    expect(arrowDeleteInPhase(Phase.Upkeep, true)).toBe(Phase.FirstMain);
    expect(arrowDeleteInPhase(Phase.FirstMain, true)).toBe(Phase.BeginCombat);
    expect(arrowDeleteInPhase(Phase.DeclareAttackers, true)).toBe(Phase.SecondMain);
    expect(arrowDeleteInPhase(Phase.EndCombat, true)).toBe(Phase.SecondMain);
    expect(arrowDeleteInPhase(Phase.SecondMain, true)).toBe(Phase.EndCleanup);
    expect(arrowDeleteInPhase(Phase.EndCleanup, true)).toBe(11);
  });

  it('leaves the field unset with the option off, so the arrow goes at the next phase change', () => {
    expect(arrowDeleteInPhase(Phase.DeclareAttackers, false)).toBeUndefined();
  });

  it('leaves the field unset outside a known phase', () => {
    expect(arrowDeleteInPhase(undefined, true)).toBeUndefined();
    expect(arrowDeleteInPhase(-1, true)).toBeUndefined();
  });
});

describe('arrowLifetime', () => {
  afterEach(() => {
    settingsStore.reset();
  });

  it('follows "Do not delete arrows inside of subphases" as it is when the arrow is sent', async () => {
    const settings = await getSettings();
    expect(arrowLifetime(Phase.BeginCombat)).toEqual({ deleteInPhase: Phase.SecondMain });

    settingsStore.setValue(Object.assign(settings, { doNotDeleteArrowsInSubPhases: false }));
    expect(arrowLifetime(Phase.BeginCombat)).toEqual({});
  });
});
