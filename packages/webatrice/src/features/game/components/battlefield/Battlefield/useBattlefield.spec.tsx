import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';
import { Enriched, games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

vi.mock('@app/hooks');

import { useSettings } from '@app/hooks';
import { makeSettings, makeSettingsHook } from '../../../../../hooks/__mocks__/useSettings';
import { makeReduxHookWrapper } from '../../../../../__test-utils__/makeHookWrapper';
import { useBattlefield } from './useBattlefield';

function stateWith(cards: ReturnType<typeof makeCard>[]): GamesState {
  const table = makeZoneEntry({
    name: Enriched.ZoneName.TABLE,
    type: 1,
    withCoords: true,
    cardCount: cards.length,
    cards,
  });
  const player = makePlayerEntry({ zones: { [Enriched.ZoneName.TABLE]: table } });
  const game = makeGameEntry({ localPlayerId: 1, players: { 1: player } });
  return { games: { 1: game } };
}

function setup(
  cards: ReturnType<typeof makeCard>[],
  mirrored = false,
  invert = false,
) {
  vi.mocked(useSettings).mockReturnValue(
    makeSettingsHook({ value: makeSettings({ invertVerticalCoordinate: invert }) }),
  );
  const { Wrapper } = makeReduxHookWrapper(
    combineReducers({ games: games.gamesReducer }),
    { games: stateWith(cards) },
  );
  const { result } = renderHook(
    () => useBattlefield({ gameId: 1, playerId: 1, mirrored }),
    { wrapper: Wrapper },
  );
  return result;
}

describe('useBattlefield', () => {
  it('buckets cards into rows by y and sorts each row by x', () => {
    const cards = [
      makeCard({ id: 1, x: 10, y: 0 }),
      makeCard({ id: 2, x: 0, y: 0 }),
      makeCard({ id: 3, x: 0, y: 2 }),
    ];
    const result = setup(cards);

    expect(result.current.rows[0].map((c) => c.id)).toEqual([2, 1]);
    expect(result.current.rows[1]).toEqual([]);
    expect(result.current.rows[2].map((c) => c.id)).toEqual([3]);
  });

  it('groups cards into stack columns by floor(x / MAX_SUBPOS) and preserves empty slots', () => {
    const cards = [
      makeCard({ id: 1, x: 0, y: 0 }),
      makeCard({ id: 2, x: 7, y: 0 }),
    ];
    const result = setup(cards);

    const row0 = result.current.stackColumnsByRow[0];
    expect(row0).toHaveLength(3);
    expect(row0[0]?.map((c) => c.id)).toEqual([1]);
    expect(row0[1]).toBeNull();
    expect(row0[2]?.map((c) => c.id)).toEqual([2]);
  });

  it('excludes attached children from row buckets so they render under their parent', () => {
    const cards = [
      makeCard({ id: 10, x: 0, y: 0 }),
      makeCard({ id: 11, x: 0, y: 2, attachCardId: 10 }),
    ];
    const result = setup(cards);

    expect(result.current.rows[2]).toEqual([]);
    expect(result.current.rows[0].map((c) => c.id)).toEqual([10]);
  });

  it('XORs the mirrored prop with the invertVerticalCoordinate setting', () => {
    expect(setup([], false, false).current.isInverted).toBe(false);
    expect(setup([], true, false).current.isInverted).toBe(true);
    expect(setup([], false, true).current.isInverted).toBe(true);
    expect(setup([], true, true).current.isInverted).toBe(false);
  });

  it('flips rowOrder for inverted boards (mirrored opponent renders 2->0)', () => {
    expect(setup([], false).current.rowOrder).toEqual([0, 1, 2]);
    expect(setup([], true).current.rowOrder).toEqual([2, 1, 0]);
  });
});
