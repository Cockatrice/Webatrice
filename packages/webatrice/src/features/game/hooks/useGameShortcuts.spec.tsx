import { ZoneName } from '@cockatrice/sockatrice';
import { renderHook } from '@testing-library/react';
import { combineReducers } from '@reduxjs/toolkit';

import { games, type GamesState } from '@cockatrice/datatrice';
import {
  makeCard,
  makeGameEntry,
  makePlayerEntry,
  makePlayerProperties,
  makeZoneEntry,
} from '@cockatrice/datatrice/testing';
import { CardAttribute } from '@cockatrice/sockatrice/generated';

import { allActionIds, defaults, ShortcutScope } from '@app/feature-widgets/shortcuts';
import { makeReduxWebClientHookWrapper } from '../../../__test-utils__/makeHookWrapper';

interface ShortcutRegistration {
  handler: (event?: KeyboardEvent) => void;
  enabled: boolean;
  scope: unknown;
}

const registrations = new Map<string, ShortcutRegistration>();

vi.mock('@app/feature-widgets/shortcuts', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@app/feature-widgets/shortcuts')
  >();
  return {
    ...actual,
    useShortcut: (
      actionId: string,
      handler: () => void,
      options: { scope: unknown; enabled?: boolean },
    ) => {
      registrations.set(actionId, {
        handler,
        enabled: options.enabled ?? true,
        scope: options.scope,
      });
    },
    useShortcutGroup: (
      actionIds: readonly string[],
      handler: (actionId: string, event: KeyboardEvent, index: number) => void,
      options: { scope: unknown; enabled?: boolean },
    ) => {
      for (const [index, actionId] of actionIds.entries()) {
        registrations.set(actionId, {
          handler: (event?: KeyboardEvent) => handler(actionId, event ?? new KeyboardEvent('keydown'), index),
          enabled: options.enabled ?? true,
          scope: options.scope,
        });
      }
    },
  };
});

import {
  SEAT_SHORTCUT_ACTIONS,
  createSeatShortcutRegistry,
  type SeatShortcutRegistry,
} from '../components/ui/SeatShortcutsContext';
import { useGameShortcuts } from './useGameShortcuts';

interface SetupOpts {
  started?: boolean;
  spectator?: boolean;
  judge?: boolean;
  activePlayerId?: number;
  conceded?: boolean;
  activePhase?: number;
  tableCards?: ReturnType<typeof makeCard>[];
  seatShortcuts?: SeatShortcutRegistry;
}

function setup(opts: SetupOpts = {}) {
  registrations.clear();
  const {
    started = true,
    spectator = false,
    judge = false,
    activePlayerId = 7,
    conceded = false,
    activePhase = 2,
    tableCards = [],
    seatShortcuts = createSeatShortcutRegistry(),
  } = opts;

  const localPlayerId = 7;
  const game = makeGameEntry({
    localPlayerId,
    started,
    spectator,
    judge,
    activePlayerId,
    activePhase,
    players: {
      [localPlayerId]: makePlayerEntry({
        properties: makePlayerProperties({ playerId: localPlayerId, conceded }),
        zones: {
          [ZoneName.TABLE]: makeZoneEntry({
            name: ZoneName.TABLE,
            cards: tableCards,
            cardCount: tableCards.length,
          }),
          [ZoneName.HAND]: makeZoneEntry({ name: ZoneName.HAND }),
          [ZoneName.DECK]: makeZoneEntry({ name: ZoneName.DECK }),
        },
      }),
    },
  });
  const gamesState: GamesState = {
    games: { 1: { ...game, info: { ...game.info, gameId: 1 } } },
    pings: {},
  };

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const onRequestConcede = vi.fn();
  const onRequestDrawMultiple = vi.fn();
  const onRequestUndoDraw = vi.fn();
  const onRequestRollDie = vi.fn();
  const onRequestLeave = vi.fn();
  const onRequestViewSideboard = vi.fn();
  const onRequestSortHandByType = vi.fn();
  const onRequestViewLibrary = vi.fn();
  const onRequestViewGraveyard = vi.fn();
  const onRequestPlayTop = vi.fn();
  const onRequestMoveTopToGrave = vi.fn();
  const onRequestMoveTopNToGrave = vi.fn();
  const onCloseRecentZoneView = vi.fn(() => false);
  const onRotateView = vi.fn();
  renderHook(() => useGameShortcuts({
    gameId: 1,
    seatShortcuts,
    onRotateView,
    onRequestConcede,
    onRequestDrawMultiple,
    onRequestUndoDraw,
    onRequestRollDie,
    onRequestLeave,
    onRequestViewSideboard,
    onRequestSortHandByType,
    onRequestViewLibrary,
    onRequestViewGraveyard,
    onRequestPlayTop,
    onRequestMoveTopToGrave,
    onRequestMoveTopNToGrave,
    onCloseRecentZoneView,
  }), {
    wrapper: Wrapper,
  });

  return {
    webClient,
    onRotateView,
    onRequestConcede,
    onRequestDrawMultiple,
    onRequestUndoDraw,
    onRequestRollDie,
    onRequestLeave,
    onRequestViewSideboard,
    onRequestSortHandByType,
    onRequestViewLibrary,
    onRequestViewGraveyard,
    onRequestPlayTop,
    onRequestMoveTopToGrave,
    onRequestMoveTopNToGrave,
    onCloseRecentZoneView,
  };
}

function fire(actionId: string) {
  const reg = registrations.get(actionId);
  if (!reg) {
    throw new Error(`No registration for ${actionId}`);
  }
  reg.handler();
}

describe('useGameShortcuts', () => {
  it('exposes the GAME-scope shortcut registrations expected by the provider', () => {
    setup();

    expect(registrations.has('game.untapAll')).toBe(true);
    expect(registrations.has('game.drawCard')).toBe(true);
    expect(registrations.has('game.endTurn')).toBe(true);
    expect(registrations.has('game.concede')).toBe(true);
    expect(registrations.has('game.shuffleLibrary')).toBe(true);
    expect(registrations.has('game.nextPhase')).toBe(true);
    expect(registrations.has('game.prevPhase')).toBe(true);
    expect(registrations.has('game.nextPhaseAction')).toBe(true);
    expect(registrations.has('game.reverseTurn')).toBe(true);
  });

  it('registers a handler for every game shortcut in the catalogue', () => {
    setup();
    const elsewhere = new Set([
      'game.moveCardDialog',
      'chat.focus',
      'game.hideRevealedCard',
    ]);
    const unhandled = allActionIds.filter(
      (id) => defaults[id].scope === ShortcutScope.GAME && !elsewhere.has(id) && !registrations.has(id),
    );
    expect(unhandled).toEqual([]);
  });

  it('sends a single bulk setCardAttr with cardId -1 for untap-all', () => {
    const tableCards = [
      makeCard({ id: 1, tapped: true }),
      makeCard({ id: 2, tapped: false }),
      makeCard({ id: 3, tapped: true }),
    ];
    const { webClient } = setup({ tableCards });

    fire('game.untapAll');

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        zone: ZoneName.TABLE,
        cardId: -1,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      }),
    );
  });

  it('draws one card and ends the turn for an active participant', () => {
    const { webClient } = setup();

    fire('game.drawCard');
    fire('game.endTurn');

    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
    expect(webClient.request.game.nextTurn).toHaveBeenCalledWith(1);
  });

  it('invokes onRequestConcede instead of dispatching a server command', () => {
    const { webClient, onRequestConcede } = setup();

    fire('game.concede');

    expect(onRequestConcede).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.concede).not.toHaveBeenCalled();
  });

  it('advances the active phase modulo PHASE_COUNT (10 wraps to 0)', () => {
    const { webClient } = setup({ activePhase: 10 });

    fire('game.nextPhase');

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(
      1,
      { phase: 0 },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it('sets a phase directly from its phase shortcut, for the active player only', () => {
    const { webClient } = setup({ activePhase: 2 });
    fire('game.setPhase0');
    fire('game.setPhase9');
    expect(vi.mocked(webClient.request.game.setActivePhase).mock.calls.map(([, params]) => params)).toEqual([
      { phase: 0 },
      { phase: 9 },
    ]);

    const offTurn = setup({ activePlayerId: 8 });
    fire('game.setPhase4');
    expect(offTurn.webClient.request.game.setActivePhase).not.toHaveBeenCalled();
  });

  it('steps back one phase, wrapping Untap to End', () => {
    const { webClient } = setup({ activePhase: 0 });

    fire('game.prevPhase');

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: 10 }, expect.anything());
  });

  it('runs next phase with action: Upkeep sets Draw, then draws one', () => {
    const { webClient } = setup({ activePhase: 1 });

    fire('game.nextPhaseAction');

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: 2 }, expect.anything());
    expect(webClient.request.game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('reverses the turn order for a participant, and not once they have conceded', () => {
    const active = setup();
    fire('game.reverseTurn');
    expect(active.webClient.request.game.reverseTurn).toHaveBeenCalledWith(1);

    const conceded = setup({ conceded: true });
    fire('game.reverseTurn');
    expect(conceded.webClient.request.game.reverseTurn).not.toHaveBeenCalled();
  });

  it('rotates the view clockwise (-1) and counterclockwise (+1), spectators included, sending nothing', () => {
    const { webClient, onRotateView } = setup({ spectator: true, activePlayerId: 99 });

    expect(registrations.get('game.rotateViewCW')?.enabled).toBe(true);
    fire('game.rotateViewCW');
    fire('game.rotateViewCCW');

    expect(onRotateView.mock.calls).toEqual([[-1], [1]]);
    expect(Object.values(webClient.request.game).some((fn) => vi.mocked(fn).mock.calls.length > 0)).toBe(false);
  });

  it('does not draw or pass turn when the local player has conceded', () => {
    const { webClient } = setup({ conceded: true });

    fire('game.drawCard');
    fire('game.endTurn');

    expect(webClient.request.game.drawCards).not.toHaveBeenCalled();
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
  });

  it('locks out spectators from every action-bound shortcut', () => {
    const { webClient, onRequestConcede } = setup({ spectator: true, activePlayerId: 99 });

    fire('game.untapAll');
    fire('game.drawCard');
    fire('game.endTurn');
    fire('game.concede');
    fire('game.shuffleLibrary');
    fire('game.nextPhase');
    fire('game.nextPhaseAction');
    fire('game.reverseTurn');

    expect(webClient.request.game.reverseTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
    expect(webClient.request.game.drawCards).not.toHaveBeenCalled();
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(webClient.request.game.setActivePhase).not.toHaveBeenCalled();
    expect(onRequestConcede).not.toHaveBeenCalled();
  });

  describe('seat-scoped shortcuts', () => {
    it('registers every seat action once, for the live game', () => {
      setup();
      for (const actionId of SEAT_SHORTCUT_ACTIONS) {
        expect(registrations.get(actionId)).toMatchObject({ enabled: true });
      }
      expect(SEAT_SHORTCUT_ACTIONS).toEqual(expect.arrayContaining([
        'game.mulligan',
        'game.setLife',
        'game.removeLocalArrows',
      ]));
    });

    it('runs the published seat operation and consumes the key', () => {
      const seatShortcuts = createSeatShortcutRegistry();
      const removeLocalArrows = vi.fn();
      seatShortcuts.publish(() => ({ 'game.removeLocalArrows': removeLocalArrows }));
      setup({ seatShortcuts });

      const event = new KeyboardEvent('keydown', { cancelable: true });
      registrations.get('game.removeLocalArrows')!.handler(event);

      expect(removeLocalArrows).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('leaves the key to the browser when no seat handles it (spectators)', () => {
      setup({ spectator: true });

      const event = new KeyboardEvent('keydown', { cancelable: true });
      registrations.get('game.removeLocalArrows')!.handler(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });
});
