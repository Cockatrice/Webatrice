import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook, act } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { useZoneContextMenu, type UseZoneContextMenuArgs } from './useZoneContextMenu';

function stateWithDeck({
  alwaysRevealTopCard = false,
  alwaysLookAtTopCard = false,
}: { alwaysRevealTopCard?: boolean; alwaysLookAtTopCard?: boolean } = {}): GamesState {
  const deck = makeZoneEntry({
    name: ZoneName.DECK,
    alwaysRevealTopCard,
    alwaysLookAtTopCard,
  });
  const player = makePlayerEntry({
    zones: { [ZoneName.DECK]: deck },
  });
  const game = makeGameEntry({
    localPlayerId: 1,
    players: { 1: player },
  });
  return { games: { 1: game } };
}

function setup(
  overrides: Partial<UseZoneContextMenuArgs> = {},
  gamesState: GamesState = stateWithDeck(),
) {
  const onClose = vi.fn();
  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const args: UseZoneContextMenuArgs = {
    gameId: 1,
    playerId: 1,
    zoneName: ZoneName.DECK,
    onClose,
    ...overrides,
  };

  const { result } = renderHook(() => useZoneContextMenu(args), { wrapper: Wrapper });
  return { result, webClient, onClose };
}

describe('useZoneContextMenu', () => {
  it('reports ready and reflects current zone flags', () => {
    const { result } = setup({}, stateWithDeck({ alwaysRevealTopCard: true }));

    expect(result.current.ready).toBe(true);
    expect(result.current.alwaysReveal).toBe(true);
    expect(result.current.alwaysLook).toBe(false);
  });

  it('reports not ready when playerId or zoneName are absent', () => {
    const { result } = setup({ playerId: null, zoneName: null });

    expect(result.current.ready).toBe(false);
    expect(result.current.alwaysReveal).toBe(false);
    expect(result.current.alwaysLook).toBe(false);
  });

  it('handleDrawOne dispatches drawCards(1) without closing on its own', () => {
    const { result, webClient, onClose } = setup();

    act(() => {
      result.current.handleDrawOne();
    });

    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('toggles alwaysReveal by sending the negated flag', () => {
    const { result, webClient } = setup({}, stateWithDeck({ alwaysRevealTopCard: true }));

    act(() => {
      result.current.handleToggleAlwaysReveal();
    });

    expect(webClient.request.game.changeZoneProperties).toHaveBeenCalledWith(
      1,
      { zoneName: ZoneName.DECK, alwaysRevealTopCard: false },
    );
  });

  it('runAndClose composes an action with onClose on every invocation', () => {
    const { result, onClose } = setup();
    const inner = vi.fn();

    const composed = result.current.runAndClose(inner);
    act(() => {
      composed();
    });
    act(() => {
      composed();
    });

    expect(inner).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
