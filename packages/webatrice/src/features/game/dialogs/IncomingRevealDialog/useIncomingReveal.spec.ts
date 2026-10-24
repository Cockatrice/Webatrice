import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import { GameReadOnlyProvider } from '../../components/ui/GameReadOnlyContext';
import { combineReducers } from '@reduxjs/toolkit';
import { ZoneName } from '@cockatrice/sockatrice';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { useIncomingReveal } from './useIncomingReveal';

const ISLAND = makeCard({ id: 0, name: 'Island', providerId: 'island-id' });
const FOREST = makeCard({ id: 1, name: 'Forest' });

interface Spec {
  grantWriteAccess?: boolean;
  readOnly?: boolean;
  sourceOwnerId?: number;
  spectator?: boolean;
  snapshot?: ReturnType<typeof makeCard>[];
  noReveal?: boolean;
}

function setup({
  grantWriteAccess = false, readOnly = false, sourceOwnerId = 2, spectator = false, snapshot, noReveal = false,
}: Spec = {}) {
  const seat = (playerId: number, name: string) => {
    const deck = makeZoneEntry({ name: ZoneName.DECK, cardCount: 30 });
    deck.revealedCards = playerId === sourceOwnerId ? snapshot : undefined;
    return makePlayerEntry({
      properties: makePlayerProperties({ playerId, userInfo: makeUser({ name }) }),
      zones: { [ZoneName.DECK]: deck },
    });
  };
  const game = makeGameEntry({ localPlayerId: 1, spectator, players: { 1: seat(1, 'Me'), 2: seat(2, 'Lender') } });
  const gamesState = {
    games: { 1: { ...game, info: { ...game.info, gameId: 1 } } },
    pings: {},
    incomingReveal: noReveal
      ? null
      : { gameId: 1, sourceOwnerId, zoneName: ZoneName.DECK, cards: [ISLAND, FOREST], grantWriteAccess },
  } as unknown as GamesState;
  const { Wrapper, store } = makeReduxHookWrapper(combineReducers({ games: games.gamesReducer }), { games: gamesState });
  const { result } = renderHook(() => useIncomingReveal(), {
    wrapper: ({ children }) => createElement(Wrapper, null, createElement(GameReadOnlyProvider, { value: readOnly }, children)),
  });
  return { result, store };
}

describe('useIncomingReveal', () => {
  it('has nothing to show without a pending reveal', () => {
    const { result } = setup({ noReveal: true });
    expect(result.current).toMatchObject({ reveal: null, cards: [], canDragLent: false });
  });

  it('names the sender and lists the live snapshot as view cards', () => {
    const { result } = setup({ snapshot: [ISLAND] });
    expect(result.current.sourceName).toBe('Lender');
    expect(result.current.localPlayerId).toBe(1);
    expect(result.current.cards).toEqual([{ id: '0', name: 'Island', scryfallId: 'island-id' }]);
  });

  it('lists no cards for a snapshot that was never seeded', () => {
    expect(setup({ snapshot: undefined }).result.current.cards).toEqual([]);
  });

  it('makes a replay reveal read-only even when the recorded event grants write access', () => {
    const { result } = setup({ grantWriteAccess: true, readOnly: true, snapshot: [ISLAND] });
    expect(result.current.canDragLent).toBe(false);
    expect(result.current.readOnly).toBe(true);
    expect(result.current.cards).toHaveLength(1);
  });

  it('lets a seated receiver drag from a lent zone only', () => {
    expect(setup({ grantWriteAccess: true }).result.current.canDragLent).toBe(true);
    expect(setup({ grantWriteAccess: false }).result.current.canDragLent).toBe(false);
    expect(setup({ grantWriteAccess: true, spectator: true }).result.current.canDragLent).toBe(false);
    expect(setup({ grantWriteAccess: true, sourceOwnerId: 1 }).result.current.canDragLent).toBe(false);
  });

  it('dismisses the reveal and clears the sender\'s snapshot on close', () => {
    const { result, store } = setup({ snapshot: [ISLAND, FOREST] });
    act(() => result.current.close());
    const state = store.getState().games;
    expect(state.incomingReveal).toBeNull();
    expect(state.games[1].players[2].zones[ZoneName.DECK].revealedCards ?? []).toEqual([]);
  });
});
