import { act, renderHook, waitFor } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games } from '@cockatrice/datatrice';
import { makeCard, makeZoneEntry } from '@cockatrice/datatrice/testing';
import { createElement } from 'react';
import { I18nextProvider } from 'react-i18next';

import { testI18n } from '../../../../__test-utils__/renderWithProviders';
import { makeReduxWebClientHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { CardDTO } from '../../../../services/dexie/DexieDTOs/CardDTO';
import { makeDialogTestEnv, makeDialogTestGame, makeSetterSpies } from '../../__test-utils__/dialogTestEnv';
import type { HandSortKey, PromptState } from './gameDialogs.types';
import { useHandDialogActions } from './useHandDialogActions';

function setup({ hand = [7, 8, 9] } = {}) {
  const game = makeDialogTestGame({ deckCount: 50, hand });
  game.players[1].zones.hand = makeZoneEntry({
    cards: hand.map((id) => makeCard({ id, name: id === 7 ? 'Zulu' : id === 8 ? 'Alpha' : 'Beta' })),
    cardCount: hand.length,
  });
  const { env, webClient } = makeDialogTestEnv(game);
  const { Wrapper, store } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: { games: { 1: game }, pings: {} } },
    webClient,
  });
  env.readGame = () => store.getState().games.games[1];
  env.readLocalPlayer = () => env.readGame()?.players[1];
  const dispatch = vi.spyOn(store, 'dispatch');
  const set = makeSetterSpies();
  const { result } = renderHook(
    () => useHandDialogActions({ env, set }),
    {
      wrapper: ({ children }) => createElement(Wrapper, {
        children: createElement(I18nextProvider, { i18n: testI18n }, children),
      }),
    },
  );
  const lastPrompt = () => set.setPrompt.mock.calls.at(-1)?.[0] as PromptState;
  const order = () => store.getState().games.games[1].players[1].zones.hand.order;
  const expectNoCommand = () => {
    for (const request of Object.values(webClient.request.game)) {
      if (vi.isMockFunction(request)) {
        expect(request).not.toHaveBeenCalled();
      }
    }
  };
  return { result, set, webClient, lastPrompt, store, dispatch, order, expectNoCommand, env };
}

afterEach(() => vi.restoreAllMocks());

describe('useHandDialogActions', () => {
  it('bounds the mulligan prompt by hand + library and resolves 0 and below against the hand size', () => {
    const { result, webClient, lastPrompt } = setup();

    result.current.handleRequestChooseMulligan();
    expect(lastPrompt()).toMatchObject({
      title: 'Draw hand',
      label: 'Number of cards',
      helperText: '0 and lower are in comparison to current hand size',
    });
    expect(lastPrompt().initialValue).toBe('7');
    expect(lastPrompt().validate?.('54')).toBe('Enter an integer between -3 and 53.');
    lastPrompt().onSubmit('-1');

    expect(webClient.request.game.mulligan).toHaveBeenCalledWith(1, { number: 2 });
  });

  it.each<HandSortKey>(['name', 'maintype', 'manacost'])('sorts by %s locally without any game command', async (key) => {
    vi.spyOn(CardDTO, 'get').mockResolvedValue(undefined);
    const { result, dispatch, order, expectNoCommand } = setup();
    await act(async () => result.current.handleRequestSortHandBy(key));
    await waitFor(() => expect(order()).toEqual([8, 9, 7]));
    expect(dispatch).toHaveBeenCalledWith(games.Actions.zoneOrderReplacedLocally({
      gameId: 1, playerId: 1, zoneName: 'hand', order: [8, 9, 7],
    }));
    expectNoCommand();
  });

  it.each([{ hand: [] }, { hand: [7] }])('does no work for hand ', async ({ hand }) => {
    const lookup = vi.spyOn(CardDTO, 'get');
    const { result, dispatch, expectNoCommand } = setup({ hand });
    await act(async () => result.current.handleRequestSortHandBy('maintype'));
    expect(lookup).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expectNoCommand();
  });

  it('treats failed metadata lookups as unknown cards', async () => {
    vi.spyOn(CardDTO, 'get').mockRejectedValue(new Error('Unavailable'));
    const { result, order, expectNoCommand } = setup();
    await act(async () => result.current.handleRequestSortHandBy('manacost'));
    await waitFor(() => expect(order()).toEqual([8, 9, 7]));
    expectNoCommand();
  });

  it.each(['draw', 'move', 'replacement'] as const)('rejects a sort that resolves after a %s changes the hand', async (change) => {
    let resolve!: (value: undefined) => void;
    const metadata = new Promise<undefined>((done) => {
      resolve = done;
    });
    vi.spyOn(CardDTO, 'get').mockReturnValue(metadata as ReturnType<typeof CardDTO.get>);
    const { result, store, dispatch, order, expectNoCommand } = setup();
    act(() => result.current.handleRequestSortHandBy('maintype'));
    act(() => {
      if (change !== 'draw') {
        store.dispatch(games.Actions.cardRemovedFromZone({ gameId: 1, playerId: 1, zoneName: 'hand', cardId: 8 }));
      }
      if (change !== 'move') {
        store.dispatch(games.Actions.cardInsertedIntoZone({
          gameId: 1, playerId: 1, zoneName: 'hand', card: makeCard({ id: 10 }),
        }));
      }
    });
    const current = store.getState();
    dispatch.mockClear();
    await act(async () => {
      resolve(undefined);
      await metadata;
    });
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(games.Actions.zoneOrderReplacedLocally({
      gameId: 1, playerId: 1, zoneName: 'hand', order: [8, 9, 7],
    })));
    expect(store.getState()).toBe(current);
    expect(order()).toEqual(change === 'draw' ? [7, 8, 9, 10] : change === 'move' ? [7, 9] : [7, 9, 10]);
    expectNoCommand();
  });
});
