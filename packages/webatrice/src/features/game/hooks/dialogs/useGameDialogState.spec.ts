import { act, renderHook } from '@testing-library/react';

import { DEFAULT_DIE_COUNT, DEFAULT_DIE_SIDES } from '../../dialogs/RollDieDialog/RollDieDialog';
import { useGameDialogState } from './useGameDialogState';

describe('useGameDialogState', () => {
  it('starts with every dialog and menu closed and the default die', () => {
    const { result } = renderHook(() => useGameDialogState());

    expect(result.current.state).toMatchObject({
      seatCardMenu: null,
      zoneViews: [],
      prompt: null,
      moveTopUntil: null,
      rollDieOpen: false,
      lastDieSides: DEFAULT_DIE_SIDES,
      lastDieCount: DEFAULT_DIE_COUNT,
      createTokenOpen: false,
      concedeConfirm: null,
      leaveConfirm: false,
    });
  });

  it('closes an opened prompt after its submit handler runs', () => {
    const { result } = renderHook(() => useGameDialogState());
    const onSubmit = vi.fn();

    act(() => result.current.toggles.openPrompt({ title: 'T', label: 'L', onSubmit }));
    expect(result.current.state.prompt?.title).toBe('T');
    act(() => result.current.state.prompt!.onSubmit('7'));

    expect(onSubmit).toHaveBeenCalledWith('7');
    expect(result.current.state.prompt).toBeNull();
  });

  it('closes the move-top-until dialog after its submit handler runs, or on close', () => {
    const { result } = renderHook(() => useGameDialogState());
    const onSubmit = vi.fn();

    act(() => result.current.toggles.openMoveTopUntil({ onSubmit }));
    act(() => result.current.state.moveTopUntil!.onSubmit({ filter: 'Bolt', hits: 1, autoPlay: false }));
    expect(onSubmit).toHaveBeenCalledWith({ filter: 'Bolt', hits: 1, autoPlay: false });
    expect(result.current.state.moveTopUntil).toBeNull();

    act(() => result.current.toggles.openMoveTopUntil({ onSubmit }));
    act(() => result.current.toggles.closeMoveTopUntil());
    expect(result.current.state.moveTopUntil).toBeNull();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('opens and closes each flag through its toggle', () => {
    const { result } = renderHook(() => useGameDialogState());

    act(() => result.current.toggles.openGameInfo());
    expect(result.current.state.gameInfoOpen).toBe(true);
    act(() => result.current.toggles.openUnconcede());
    expect(result.current.state.concedeConfirm).toBe('unconcede');
    act(() => result.current.toggles.closeConcedeConfirm());
    expect(result.current.state.concedeConfirm).toBeNull();
    act(() => result.current.toggles.closeGameInfo());
    expect(result.current.state.gameInfoOpen).toBe(false);
  });

  it('keeps its setters and toggles stable while the state changes', () => {
    const { result } = renderHook(() => useGameDialogState());
    const { set, toggles, state } = result.current;

    act(() => toggles.openRollDie());

    expect(result.current.state).not.toBe(state);
    expect(result.current.set).toBe(set);
    expect(result.current.toggles).toBe(toggles);
  });
});
