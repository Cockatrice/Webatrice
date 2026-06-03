import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

const useDroppableMock = vi.fn();
vi.mock('@dnd-kit/core', () => ({
  useDroppable: (opts: unknown) => {
    useDroppableMock(opts);
    return { setNodeRef: vi.fn(), isOver: false };
  },
}));

import { makeReduxHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { useHandZone, type UseHandZoneArgs } from './useHandZone';

function stateWithHand(cards: ReturnType<typeof makeCard>[]): GamesState {
  const hand = makeZoneEntry({
    name: ZoneName.HAND,
    cardCount: cards.length,
    cards,
  });
  const player = makePlayerEntry({ zones: { [ZoneName.HAND]: hand } });
  const game = makeGameEntry({ localPlayerId: 1, players: { 1: player } });
  return { games: { 1: game } };
}

function setup(
  cards: ReturnType<typeof makeCard>[],
  overrides: Partial<UseHandZoneArgs> = {},
) {
  const { Wrapper } = makeReduxHookWrapper(
    combineReducers({ games: games.gamesReducer }),
    { games: stateWithHand(cards) },
  );
  const args: UseHandZoneArgs = {
    gameId: 1,
    playerId: 1,
    canAct: true,
    ...overrides,
  };
  const { result } = renderHook(() => useHandZone(args), { wrapper: Wrapper });
  return { result };
}

beforeEach(() => {
  useDroppableMock.mockClear();
});

describe('useHandZone', () => {
  it('returns the hand cards from Redux state', () => {
    const cards = [makeCard({ id: 1, name: 'Forest' }), makeCard({ id: 2, name: 'Mountain' })];
    const { result } = setup(cards);

    expect(result.current.cards.map((c) => c.id)).toEqual([1, 2]);
  });

  it('registers a droppable scoped to this player when canAct is true', () => {
    setup([], { canAct: true, playerId: 1 });

    const callArgs = useDroppableMock.mock.calls[0][0] as {
      id: string;
      disabled: boolean;
      data: { targetPlayerId: number; targetZone: string };
    };
    expect(callArgs.id).toBe('hand-1');
    expect(callArgs.disabled).toBe(false);
    expect(callArgs.data.targetZone).toBe(ZoneName.HAND);
  });

  it('disables the droppable when canAct is false', () => {
    setup([], { canAct: false });

    const callArgs = useDroppableMock.mock.calls[0][0] as { disabled: boolean };
    expect(callArgs.disabled).toBe(true);
  });

  it('forwards a context-menu event on empty hand space to the callback', () => {
    const onZoneContextMenu = vi.fn();
    const { result } = setup([], { onZoneContextMenu });

    const target = document.createElement('div');
    const event = {
      target,
      closest: () => null,
    } as unknown as React.MouseEvent<HTMLDivElement>;
    result.current.handleZoneContextMenu(event);

    expect(onZoneContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not call onZoneContextMenu when the event target is a card slot', () => {
    const onZoneContextMenu = vi.fn();
    const { result } = setup([], { onZoneContextMenu });

    const cardEl = document.createElement('div');
    cardEl.setAttribute('data-card-id', '5');
    const event = {
      target: cardEl,
    } as unknown as React.MouseEvent<HTMLDivElement>;
    result.current.handleZoneContextMenu(event);

    expect(onZoneContextMenu).not.toHaveBeenCalled();
  });
});
