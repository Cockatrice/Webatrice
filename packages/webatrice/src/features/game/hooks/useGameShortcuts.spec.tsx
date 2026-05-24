import { renderHook } from '@testing-library/react';
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

interface ShortcutRegistration {
  handler: () => void;
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
  };
});

import { useGameShortcuts } from './useGameShortcuts';

interface SetupOpts {
  started?: boolean;
  spectator?: boolean;
  judge?: boolean;
  activePlayerId?: number;
  conceded?: boolean;
  activePhase?: number;
  tableCards?: ReturnType<typeof makeCard>[];
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
          [Enriched.ZoneName.TABLE]: makeZoneEntry({
            name: Enriched.ZoneName.TABLE,
            cards: tableCards,
            cardCount: tableCards.length,
          }),
          [Enriched.ZoneName.HAND]: makeZoneEntry({ name: Enriched.ZoneName.HAND }),
          [Enriched.ZoneName.DECK]: makeZoneEntry({ name: Enriched.ZoneName.DECK }),
        },
      }),
    },
  });
  const gamesState: GamesState = {
    games: { 1: { ...game, info: { ...game.info, gameId: 1 } } },
  };

  const { Wrapper, webClient } = makeReduxWebClientHookWrapper({
    reducer: combineReducers({ games: games.gamesReducer }),
    preloadedState: { games: gamesState },
  });

  const onRequestConcede = vi.fn();
  renderHook(() => useGameShortcuts({ gameId: 1, onRequestConcede }), {
    wrapper: Wrapper,
  });

  return { webClient, onRequestConcede };
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
  });

  it('untaps each tapped card on the local battlefield via setCardAttr', () => {
    const tableCards = [
      makeCard({ id: 1, tapped: true }),
      makeCard({ id: 2, tapped: false }),
      makeCard({ id: 3, tapped: true }),
    ];
    const { webClient } = setup({ tableCards });

    fire('game.untapAll');

    expect(webClient.request.game.setCardAttr).toHaveBeenCalledTimes(2);
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        cardId: 1,
        attribute: CardAttribute.AttrTapped,
        attrValue: '0',
      }),
    );
    expect(webClient.request.game.setCardAttr).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ cardId: 3 }),
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

    expect(webClient.request.game.setActivePhase).toHaveBeenCalledWith(1, { phase: 0 });
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

    expect(webClient.request.game.setCardAttr).not.toHaveBeenCalled();
    expect(webClient.request.game.drawCards).not.toHaveBeenCalled();
    expect(webClient.request.game.nextTurn).not.toHaveBeenCalled();
    expect(webClient.request.game.shuffle).not.toHaveBeenCalled();
    expect(webClient.request.game.setActivePhase).not.toHaveBeenCalled();
    expect(onRequestConcede).not.toHaveBeenCalled();
  });
});

