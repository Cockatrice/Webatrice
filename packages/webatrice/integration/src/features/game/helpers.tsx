import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { useLocation } from 'react-router-dom';
import { afterEach, beforeEach, vi } from 'vitest';

import { Event_GameJoined, Event_GameJoinedSchema, Event_GameStateChanged, Event_GameStateChangedSchema, ServerInfo_CardSchema, ServerInfo_GameSchema, ServerInfo_PlayerPropertiesSchema, ServerInfo_PlayerSchema, ServerInfo_UserSchema, ServerInfo_ZoneSchema } from '@cockatrice/sockatrice/generated';
import { games, server } from '@cockatrice/datatrice';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { store } from '../../helpers/setup';

// Renders the current pathname so navigation flows can assert redirects.
export function LocationProbe() {
  const location = useLocation();
  return <span data-testid="app-location">{location.pathname}</span>;
}

export function buildEventGameJoined(args: {
  gameId: number;
  localPlayerId: number;
  hostId: number;
}): Event_GameJoined {
  return create(Event_GameJoinedSchema, {
    gameInfo: create(ServerInfo_GameSchema, {
      gameId: args.gameId,
      roomId: 1,
      description: 'Integration Test Game',
      gameTypes: [],
      started: false,
    }),
    hostId: args.hostId,
    playerId: args.localPlayerId,
    spectator: false,
    judge: false,
    resuming: false,
  });
}

export interface TableCardSeed {
  id: number;
  name?: string;
  x: number;
  y: number;
  tapped?: boolean;
}

export interface BuildGameStateOptions {
  // Seed the named player's `table` zone with cards (default: empty zones, so
  // the board-rendering flows stay behavior-equivalent to the pre-split spec).
  tableCardsByPlayer?: Record<number, TableCardSeed[]>;
}

export function buildEventGameStateChanged(
  playerIds: number[],
  localId: number,
  opts: BuildGameStateOptions = {},
): Event_GameStateChanged {
  return create(Event_GameStateChangedSchema, {
    gameStarted: true,
    activePlayerId: localId,
    activePhase: 0,
    playerList: playerIds.map((pid) => {
      const tableCards = opts.tableCardsByPlayer?.[pid] ?? [];
      return create(ServerInfo_PlayerSchema, {
        properties: create(ServerInfo_PlayerPropertiesSchema, {
          playerId: pid,
          userInfo: create(ServerInfo_UserSchema, { name: `P${pid}` }),
          spectator: false,
          conceded: false,
          readyStart: false,
          judge: false,
        }),
        deckList: '',
        zoneList: [
          create(ServerInfo_ZoneSchema, {
            name: 'table',
            type: 1,
            withCoords: true,
            cardCount: tableCards.length,
            cardList: tableCards.map((c) =>
              create(ServerInfo_CardSchema, {
                id: c.id,
                name: c.name ?? `Card ${c.id}`,
                x: c.x,
                y: c.y,
                tapped: c.tapped ?? false,
              }),
            ),
          }),
          create(ServerInfo_ZoneSchema, {
            name: 'hand',
            type: 0,
            withCoords: false,
            cardCount: 0,
            cardList: [],
          }),
          create(ServerInfo_ZoneSchema, {
            name: 'deck',
            type: 2,
            withCoords: false,
            cardCount: 40,
            cardList: [],
          }),
          create(ServerInfo_ZoneSchema, {
            name: 'grave',
            type: 1,
            withCoords: false,
            cardCount: 0,
            cardList: [],
          }),
          create(ServerInfo_ZoneSchema, {
            name: 'rfg',
            type: 1,
            withCoords: false,
            cardCount: 0,
            cardList: [],
          }),
        ],
        counterList: [],
        arrowList: [],
      });
    }),
  });
}

export function simulateConnected() {
  act(() => {
    store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null } }));
  });
}

// Registers the shared game-board lifecycle (real timers + connected before
// each test; leave all games + disconnect after). Call once at the top of a
// spec file's module scope.
export function registerGameBoardHooks() {
  beforeEach(() => {
    // Integration setup installs fake timers for KeepAliveService control;
    // waitFor / React effects need real timers to run between dispatch and assert.
    vi.useRealTimers();
    simulateConnected();
  });

  afterEach(() => {
    act(() => {
      for (const gameId of Object.keys(store.getState().games.games)) {
        store.dispatch(games.Actions.gameLeft({ gameId: Number(gameId) }));
      }
      store.dispatch(server.Actions.updateStatus({ status: { state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null } }));
    });
  });
}
