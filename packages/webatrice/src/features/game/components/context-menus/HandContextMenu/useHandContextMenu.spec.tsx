import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { useHandContextMenu, type UseHandContextMenuArgs } from './useHandContextMenu';

function setup(overrides: Partial<UseHandContextMenuArgs> = {}) {
  const onClose = vi.fn();
  const onRequestChooseMulligan = vi.fn();
  const onRequestRevealHand = vi.fn();
  const onRequestRevealRandom = vi.fn();
  const onRequestViewHand = vi.fn();
  const onRequestSortHandBy = vi.fn();
  const onRequestMoveHandToDeck = vi.fn();
  const onRequestMoveHandToZone = vi.fn();

  const gamesState: GamesState = { games: {} };
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const args: UseHandContextMenuArgs = {
    gameId: 1,
    handSize: 7,
    onClose,
    onRequestChooseMulligan,
    onRequestRevealHand,
    onRequestRevealRandom,
    onRequestViewHand,
    onRequestSortHandBy,
    onRequestMoveHandToDeck,
    onRequestMoveHandToZone,
    ...overrides,
  };

  const { result } = renderHook(() => useHandContextMenu(args), { wrapper: Wrapper });
  return {
    result,
    webClient,
    onClose,
    onRequestChooseMulligan,
    onRequestRevealHand,
    onRequestRevealRandom,
    onRequestViewHand,
    onRequestSortHandBy,
    onRequestMoveHandToDeck,
    onRequestMoveHandToZone,
  };
}

describe('useHandContextMenu', () => {
  it('dispatches a same-size mulligan and closes the menu', () => {
    const { result, webClient, onClose } = setup({ handSize: 7 });

    act(() => {
      result.current.handleSameSize();
    });

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 7 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('floors minus-one mulligan at 1 even when handSize is 0', () => {
    const { result, webClient } = setup({ handSize: 0 });

    act(() => {
      result.current.handleMinusOne();
    });

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('forwards dialog requests to their owning callback and closes', () => {
    const { result, onRequestChooseMulligan, onRequestRevealHand, onClose } = setup();

    act(() => {
      result.current.handleChoose();
    });
    act(() => {
      result.current.handleRevealHand();
    });

    expect(onRequestChooseMulligan).toHaveBeenCalledTimes(1);
    expect(onRequestRevealHand).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('propagates the sort key and move-to-zone target verbatim', () => {
    const { result, onRequestSortHandBy, onRequestMoveHandToZone, onRequestMoveHandToDeck } = setup();

    act(() => {
      result.current.handleSortBy('manacost');
    });
    act(() => {
      result.current.handleMoveToZone('grave');
    });
    act(() => {
      result.current.handleMoveToDeck(true);
    });

    expect(onRequestSortHandBy).toHaveBeenCalledWith('manacost');
    expect(onRequestMoveHandToZone).toHaveBeenCalledWith('grave');
    expect(onRequestMoveHandToDeck).toHaveBeenCalledWith(true);
  });

  it('no-ops every action when gameId is absent (no live game)', () => {
    const {
      result,
      webClient,
      onClose,
      onRequestChooseMulligan,
      onRequestRevealHand,
      onRequestSortHandBy,
    } = setup({ gameId: undefined });

    act(() => {
      result.current.handleSameSize();
      result.current.handleMinusOne();
      result.current.handleChoose();
      result.current.handleRevealHand();
      result.current.handleSortBy('name');
    });

    expect(webClient.request.game.mulligan).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onRequestChooseMulligan).not.toHaveBeenCalled();
    expect(onRequestRevealHand).not.toHaveBeenCalled();
    expect(onRequestSortHandBy).not.toHaveBeenCalled();
  });
});
