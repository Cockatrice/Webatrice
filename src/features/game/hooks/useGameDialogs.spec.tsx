import { act, renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { games, Enriched, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import { CardAttribute } from '@cockatrice/sockatrice/generated';

import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';

vi.mock('../../../hooks/useSettings');

import { useGameDialogs } from './useGameDialogs';
import type { GameAccess } from './useGameAccess';

interface SetupOpts {
  localPlayerId?: number;
  isSpectator?: boolean;
  canAct?: boolean;
  cardId?: number;
}

function setup(opts: SetupOpts = {}) {
  const localPlayerId = opts.localPlayerId ?? 1;
  const isSpectator = opts.isSpectator ?? false;
  const canAct = opts.canAct ?? true;

  const localPlayer = makePlayerEntry({
    properties: makePlayerProperties({ playerId: localPlayerId }),
    zones: {
      [Enriched.ZoneName.HAND]: makeZoneEntry({
        name: Enriched.ZoneName.HAND,
        cardCount: 0,
        order: [],
        byId: {},
      }),
      [Enriched.ZoneName.DECK]: makeZoneEntry({
        name: Enriched.ZoneName.DECK,
        cardCount: 60,
      }),
      [Enriched.ZoneName.TABLE]: makeZoneEntry({ name: Enriched.ZoneName.TABLE }),
      [Enriched.ZoneName.GRAVE]: makeZoneEntry({ name: Enriched.ZoneName.GRAVE }),
    },
  });

  const game = makeGameEntry({
    localPlayerId,
    started: true,
    spectator: isSpectator,
    players: { [localPlayerId]: localPlayer },
  });
  const gamesState: GamesState = {
    games: { 1: { ...game, info: { ...game.info, gameId: 1 } } },
  };

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const localAccess: GameAccess = {
    canAct,
    canView: true,
    isLocalPlayer: true,
  };
  const startPendingArrow = vi.fn();
  const startPendingAttach = vi.fn();

  const { result } = renderHook(
    () =>
      useGameDialogs({
        gameId: 1,
        game: { ...game, info: { ...game.info, gameId: 1 } },
        localPlayer,
        localAccess,
        isSpectator,
        startPendingArrow,
        startPendingAttach,
      }),
    { wrapper: Wrapper },
  );

  return {
    result,
    webClient,
    startPendingArrow,
    startPendingAttach,
    localPlayerId,
  };
}

function makeMouseEvent(): React.MouseEvent {
  return {
    preventDefault: vi.fn(),
    clientX: 100,
    clientY: 200,
  } as unknown as React.MouseEvent;
}

describe('useGameDialogs', () => {
  it('opens the roll-die dialog via openRollDie and dispatches rollDie on submit', () => {
    const { result, webClient } = setup();

    expect(result.current.rollDieOpen).toBe(false);

    act(() => {
      result.current.openRollDie();
    });
    expect(result.current.rollDieOpen).toBe(true);

    act(() => {
      result.current.handleRollDieSubmit({ sides: 20, count: 3 });
    });

    expect(webClient.request.game.rollDie).toHaveBeenCalledWith(1, { sides: 20, count: 3 });
    expect(result.current.rollDieOpen).toBe(false);
    expect(result.current.lastDieSides).toBe(20);
    expect(result.current.lastDieCount).toBe(3);
  });

  it('opens the card menu on right-click and clears it via closeCardMenu', () => {
    const { result } = setup();
    const card = makeCard({ id: 5 });
    const event = makeMouseEvent();

    act(() => {
      result.current.handleCardContextMenu(1, Enriched.ZoneName.TABLE, card, event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.cardMenu).not.toBeNull();
    expect(result.current.cardMenu?.card.id).toBe(5);
    expect(result.current.cardMenu?.anchorPosition).toEqual({ top: 200, left: 100 });

    act(() => {
      result.current.closeCardMenu();
    });
    expect(result.current.cardMenu).toBeNull();
  });

  it('opens a set-PT prompt from the card menu and dispatches setCardAttr on submit', () => {
    const { result, webClient } = setup();
    const card = makeCard({ id: 5, pt: '2/2' });

    act(() => {
      result.current.handleCardContextMenu(1, Enriched.ZoneName.TABLE, card, makeMouseEvent());
    });
    act(() => {
      result.current.handleRequestSetPT();
    });

    expect(result.current.prompt).not.toBeNull();
    expect(result.current.prompt?.title).toBe('Set power/toughness');
    expect(result.current.prompt?.initialValue).toBe('2/2');

    act(() => {
      result.current.prompt!.onSubmit('3/3');
    });

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        cardId: 5,
        attribute: CardAttribute.AttrPT,
        attrValue: '3/3',
      }),
    );
    expect(result.current.prompt).toBeNull();
  });

  it('routes the concede flow through confirmConcede → webClient.game.concede', () => {
    const { result, webClient } = setup();

    expect(result.current.concedeConfirm).toBeNull();

    act(() => {
      result.current.openConcede();
    });
    expect(result.current.concedeConfirm).toBe('concede');

    act(() => {
      result.current.confirmConcede();
    });

    expect(webClient.request.game.concede).toHaveBeenCalledWith(1);
    expect(result.current.concedeConfirm).toBeNull();
  });

  it('ignores zone right-clicks on unsupported zones and on remote players', () => {
    const { result } = setup({ localPlayerId: 1 });

    act(() => {
      result.current.handleZoneContextMenu(1, Enriched.ZoneName.TABLE, makeMouseEvent());
    });
    expect(result.current.zoneMenu).toBeNull();

    act(() => {
      result.current.handleZoneContextMenu(2, Enriched.ZoneName.GRAVE, makeMouseEvent());
    });
    expect(result.current.zoneMenu).toBeNull();

    act(() => {
      result.current.handleZoneContextMenu(1, Enriched.ZoneName.GRAVE, makeMouseEvent());
    });
    expect(result.current.zoneMenu?.zoneName).toBe(Enriched.ZoneName.GRAVE);
  });

  it('blocks the player and hand context menus for spectators', () => {
    const { result } = setup({ isSpectator: true });

    act(() => {
      result.current.handlePlayerContextMenu(makeMouseEvent());
    });
    expect(result.current.playerMenu).toBeNull();

    act(() => {
      result.current.handleHandContextMenu(makeMouseEvent());
    });
    expect(result.current.handMenu).toBeNull();
  });

  it('opens a reveal dialog from the deck zone and dispatches revealCards on submit', () => {
    const { result, webClient } = setup();

    act(() => {
      result.current.handleRequestRevealTopN();
    });
    expect(result.current.revealState?.zoneName).toBe(Enriched.ZoneName.DECK);
    expect(result.current.revealState?.showCountInput).toBe(true);

    act(() => {
      result.current.revealState!.onSubmit({ targetPlayerId: 1, topCards: 3 });
    });

    expect(webClient.request.game.revealCards).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        zoneName: Enriched.ZoneName.DECK,
        playerId: 1,
        topCards: 3,
      }),
    );
    expect(result.current.revealState).toBeNull();
  });
});
