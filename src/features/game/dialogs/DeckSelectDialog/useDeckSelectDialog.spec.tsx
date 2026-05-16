import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
} from '@cockatrice/datatrice/testing';

import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { useDeckSelectDialog } from './useDeckSelectDialog';

const VALID_COD_XML =
  '<?xml version="1.0"?><cockatrice_deck version="1"><zone name="main"><card number="4" name="Island"/></zone></cockatrice_deck>';

function setup(playerProps: Parameters<typeof makePlayerProperties>[0] = {}) {
  const game = makeGameEntry({
    localPlayerId: 1,
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({ playerId: 1, ...playerProps }),
      }),
    },
  });
  const gamesState: GamesState = { games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } };

  return makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });
}

describe('useDeckSelectDialog', () => {
  it('reports canSubmit=false until non-whitespace deck text is entered', () => {
    const { Wrapper } = setup();
    const { result } = renderHook(() => useDeckSelectDialog(1), { wrapper: Wrapper });

    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setDeckText('   '));
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setDeckText(VALID_COD_XML));
    expect(result.current.canSubmit).toBe(true);
  });

  it('dispatches deckSelect with the pasted XML on a valid submit', () => {
    const { Wrapper, webClient } = setup();
    const { result } = renderHook(() => useDeckSelectDialog(1), { wrapper: Wrapper });

    act(() => result.current.setDeckText(VALID_COD_XML));
    act(() => result.current.handleSubmitDeck());

    expect(webClient.request.game.deckSelect).toHaveBeenCalledWith(1, { deck: VALID_COD_XML });
    expect(result.current.validationError).toBeNull();
  });

  it('rejects non-XML deck text without dispatching deckSelect', () => {
    const { Wrapper, webClient } = setup();
    const { result } = renderHook(() => useDeckSelectDialog(1), { wrapper: Wrapper });

    act(() => result.current.setDeckText('4 Lightning Bolt'));
    act(() => result.current.handleSubmitDeck());

    expect(webClient.request.game.deckSelect).not.toHaveBeenCalled();
    expect(result.current.validationError).toMatch(/not a valid cockatrice deck/i);
  });

  it('toggles readyStart against the current ready flag when canToggleReady is satisfied', () => {
    const { Wrapper, webClient } = setup({ deckHash: 'abc123', readyStart: false });
    const { result } = renderHook(() => useDeckSelectDialog(1), { wrapper: Wrapper });

    expect(result.current.canToggleReady).toBe(true);

    act(() => result.current.handleToggleReady());

    expect(webClient.request.game.readyStart).toHaveBeenCalledWith(1, { ready: true });
  });

  it('does not dispatch when gameId is undefined (no current game)', () => {
    const { Wrapper, webClient } = setup({ deckHash: 'abc123' });
    const { result } = renderHook(() => useDeckSelectDialog(undefined), { wrapper: Wrapper });

    act(() => result.current.setDeckText(VALID_COD_XML));
    act(() => result.current.handleSubmitDeck());
    act(() => result.current.handleToggleReady());

    expect(webClient.request.game.deckSelect).not.toHaveBeenCalled();
    expect(webClient.request.game.readyStart).not.toHaveBeenCalled();
  });
});
