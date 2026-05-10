import { Actions } from './shortcuts.actions';
import { shortcutsReducer } from './shortcuts.reducer';
import { initialState } from './shortcuts.reducer.bindings';
import { Selectors } from './shortcuts.selectors';

describe('shortcutsReducer — bindings', () => {
  it('returns initialState for the init action', () => {
    const result = shortcutsReducer(undefined, { type: '@@INIT' });
    expect(result).toEqual(initialState);
  });

  it('hydrate populates overrides and flips hydrated true', () => {
    const result = shortcutsReducer(
      undefined,
      Actions.hydrate({ overrides: { 'game.untapAll': ['Ctrl+KeyU'] } }),
    );
    expect(result.hydrated).toBe(true);
    expect(result.overrides['game.untapAll']).toEqual(['Ctrl+KeyU']);
  });

  it('hydrate is a no-op once already hydrated (StrictMode-safe)', () => {
    const first = shortcutsReducer(
      undefined,
      Actions.hydrate({ overrides: { 'game.untapAll': ['F5'] } }),
    );
    const second = shortcutsReducer(
      first,
      Actions.hydrate({ overrides: { 'game.drawCard': ['F2'] } }),
    );
    expect(second.overrides).toEqual({ 'game.untapAll': ['F5'] });
  });

  it('setOverride writes (and replaces) the action override', () => {
    const after1 = shortcutsReducer(
      undefined,
      Actions.setOverride({ actionId: 'game.drawCard', sequences: ['Ctrl+KeyD'] }),
    );
    const after2 = shortcutsReducer(
      after1,
      Actions.setOverride({ actionId: 'game.drawCard', sequences: ['F2'] }),
    );
    expect(after2.overrides['game.drawCard']).toEqual(['F2']);
  });

  it('resetAction removes the override entry', () => {
    const seeded = shortcutsReducer(
      undefined,
      Actions.setOverride({ actionId: 'game.endTurn', sequences: ['F12'] }),
    );
    const after = shortcutsReducer(seeded, Actions.resetAction({ actionId: 'game.endTurn' }));
    expect('game.endTurn' in after.overrides).toBe(false);
  });

  it('resetAll clears all overrides but preserves hydrated flag', () => {
    let state = shortcutsReducer(undefined, Actions.hydrate({ overrides: { 'game.untapAll': ['F6'] } }));
    state = shortcutsReducer(
      state,
      Actions.setOverride({ actionId: 'deck.save', sequences: ['Ctrl+KeyW'] }),
    );
    state = shortcutsReducer(state, Actions.resetAll());
    expect(state.overrides).toEqual({});
    expect(state.hydrated).toBe(true);
  });
});

describe('shortcutsReducer — recording state machine', () => {
  it('startRecording seeds recordingSequences from existing override', () => {
    const seeded = shortcutsReducer(
      undefined,
      Actions.setOverride({ actionId: 'game.untapAll', sequences: ['Ctrl+KeyU'] }),
    );
    const after = shortcutsReducer(seeded, Actions.startRecording({ actionId: 'game.untapAll' }));
    expect(after.recordingActionId).toBe('game.untapAll');
    expect(after.recordingSequences).toEqual(['Ctrl+KeyU']);
  });

  it('appendCapturedSequence pushes a new sequence and de-dupes by string equality', () => {
    let state = shortcutsReducer(undefined, Actions.startRecording({ actionId: 'deck.addCard' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'Equal' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'NumpadAdd' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'Equal' })); // dup
    expect(state.recordingSequences).toEqual(['Equal', 'NumpadAdd']);
  });

  it('appendCapturedSequence is a no-op when not recording', () => {
    const state = shortcutsReducer(undefined, Actions.appendCapturedSequence({ sequence: 'F5' }));
    expect(state.recordingSequences).toEqual([]);
  });

  it('removeCapturedSequence drops the matching entry', () => {
    let state = shortcutsReducer(undefined, Actions.startRecording({ actionId: 'deck.addCard' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'Equal' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'NumpadAdd' }));
    state = shortcutsReducer(state, Actions.removeCapturedSequence({ sequence: 'Equal' }));
    expect(state.recordingSequences).toEqual(['NumpadAdd']);
  });

  it('cancelRecording clears the capture state', () => {
    let state = shortcutsReducer(undefined, Actions.startRecording({ actionId: 'game.untapAll' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'F6' }));
    state = shortcutsReducer(state, Actions.cancelRecording());
    expect(state.recordingActionId).toBeNull();
    expect(state.recordingSequences).toEqual([]);
  });

  it('startRecording on a different action seeds fresh capture state from that action', () => {
    let state = shortcutsReducer(undefined, Actions.startRecording({ actionId: 'game.untapAll' }));
    state = shortcutsReducer(state, Actions.appendCapturedSequence({ sequence: 'F6' }));
    state = shortcutsReducer(state, Actions.startRecording({ actionId: 'deck.save' }));
    expect(state.recordingActionId).toBe('deck.save');
    expect(state.recordingSequences).toEqual([]);
  });
});

describe('Selectors', () => {
  const stateWith = (overrides: Record<string, string[]> = {}) => ({
    shortcuts: { ...initialState, overrides },
  });

  it('getOverrides returns the raw overrides map', () => {
    const state = stateWith({ 'game.untapAll': ['F6'] });
    expect(Selectors.getOverrides(state)).toEqual({ 'game.untapAll': ['F6'] });
  });

  it('isOverridden distinguishes overridden vs default', () => {
    const state = stateWith({ 'game.untapAll': ['F6'] });
    expect(Selectors.isOverridden(state, 'game.untapAll')).toBe(true);
    expect(Selectors.isOverridden(state, 'game.drawCard')).toBe(false);
  });
});
