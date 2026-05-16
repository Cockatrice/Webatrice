import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { Enriched, games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeUser,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';

import { makeReduxHookWrapper } from '../../../../__test-utils__/makeHookWrapper';
import { useZoneViewDialog, zoneLabel } from './useZoneViewDialog';

function setup(zoneArgs: Parameters<typeof makeZoneEntry>[0]) {
  const game = makeGameEntry({
    localPlayerId: 1,
    players: {
      1: makePlayerEntry({
        properties: makePlayerProperties({
          playerId: 1,
          userInfo: makeUser({ name: 'Trajer' }),
        }),
        zones: {
          [zoneArgs.name!]: makeZoneEntry(zoneArgs),
        },
      }),
    },
  });
  const gamesState: GamesState = { games: { 1: { ...game, info: { ...game.info, gameId: 1 } } } };

  return makeReduxHookWrapper(
    combineReducers({ games: games.gamesReducer }),
    { games: gamesState },
  );
}

describe('useZoneViewDialog', () => {
  it('zoneLabel maps short codes to human-readable names', () => {
    expect(zoneLabel('grave')).toBe('Graveyard');
    expect(zoneLabel('rfg')).toBe('Exile');
    expect(zoneLabel('deck')).toBe('Library');
    expect(zoneLabel(undefined)).toBe('');
  });

  it('builds a title from the player name, zone label, and card count', () => {
    const { Wrapper } = setup({
      name: Enriched.ZoneName.GRAVE,
      cards: [makeCard({ id: 1 }), makeCard({ id: 2 })],
      cardCount: 2,
    });

    const { result } = renderHook(
      () =>
        useZoneViewDialog({
          gameId: 1,
          playerId: 1,
          zoneName: Enriched.ZoneName.GRAVE,
          initialPosition: { x: 0, y: 0 },
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.count).toBe(2);
    expect(result.current.cards).toHaveLength(2);
    expect(result.current.title).toBe('Trajer Graveyard (2)');
  });

  it('falls back to an empty result when gameId or playerId is undefined (no current game)', () => {
    const { Wrapper } = setup({ name: Enriched.ZoneName.GRAVE, cardCount: 0 });

    const { result } = renderHook(
      () =>
        useZoneViewDialog({
          gameId: undefined,
          playerId: undefined,
          zoneName: Enriched.ZoneName.GRAVE,
          initialPosition: { x: 10, y: 20 },
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.cards).toEqual([]);
    expect(result.current.count).toBe(0);
    expect(result.current.title).toMatch(/Graveyard/);
  });

  it('honors initialPosition on mount and updates position when the user drags the header', () => {
    const { Wrapper } = setup({ name: Enriched.ZoneName.GRAVE, cardCount: 0 });

    const { result } = renderHook(
      () =>
        useZoneViewDialog({
          gameId: 1,
          playerId: 1,
          zoneName: Enriched.ZoneName.GRAVE,
          initialPosition: { x: 100, y: 50 },
        }),
      { wrapper: Wrapper },
    );

    expect(result.current.position).toEqual({ x: 100, y: 50 });

    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const target = { setPointerCapture, closest: () => null } as unknown as HTMLElement;

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerId: 7,
        clientX: 200,
        clientY: 200,
        target,
        currentTarget: target,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      result.current.handlePointerMove({
        pointerId: 7,
        clientX: 230,
        clientY: 240,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(result.current.position).toEqual({ x: 130, y: 90 });

    act(() => {
      result.current.handlePointerUp({
        pointerId: 7,
        currentTarget: { releasePointerCapture } as unknown as HTMLElement,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('ignores pointerdown when the pointer originates on an interactive child (button)', () => {
    const { Wrapper } = setup({ name: Enriched.ZoneName.GRAVE, cardCount: 0 });

    const { result } = renderHook(
      () =>
        useZoneViewDialog({
          gameId: 1,
          playerId: 1,
          zoneName: Enriched.ZoneName.GRAVE,
          initialPosition: { x: 0, y: 0 },
        }),
      { wrapper: Wrapper },
    );

    const setPointerCapture = vi.fn();
    const target = {
      setPointerCapture,
      closest: (sel: string) => (sel === 'button' ? ({} as HTMLElement) : null),
    } as unknown as HTMLElement;

    act(() => {
      result.current.handlePointerDown({
        button: 0,
        pointerId: 7,
        clientX: 200,
        clientY: 200,
        target,
        currentTarget: target,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      result.current.handlePointerMove({
        pointerId: 7,
        clientX: 230,
        clientY: 240,
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(result.current.position).toEqual({ x: 0, y: 0 });
  });
});
