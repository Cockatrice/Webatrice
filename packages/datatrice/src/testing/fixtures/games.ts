import type { MessageInitShape } from '@bufbuild/protobuf';
import { Enriched } from '../../types';
import {
  ServerInfo_Arrow,
  ServerInfo_ArrowSchema,
  ServerInfo_Card,
  ServerInfo_CardSchema,
  ServerInfo_Counter,
  ServerInfo_CounterSchema,
  ServerInfo_Game,
  ServerInfo_GameSchema,
  ServerInfo_PlayerProperties,
  ServerInfo_PlayerPropertiesSchema,
  colorSchema,
} from '@cockatrice/sockatrice/generated';
import { create } from '@bufbuild/protobuf';
import { GamesState } from '../../store/games/game.interfaces';

export function makeCard(overrides: MessageInitShape<typeof ServerInfo_CardSchema> = {}): ServerInfo_Card {
  return create(ServerInfo_CardSchema, {
    id: 1,
    name: 'Test Card',
    x: 0,
    y: 0,
    faceDown: false,
    tapped: false,
    attacking: false,
    color: '',
    pt: '',
    annotation: '',
    destroyOnZoneChange: false,
    doesntUntap: false,
    counterList: [],
    attachPlayerId: -1,
    attachZone: '',
    attachCardId: -1,
    providerId: '',
    ...overrides,
  });
}

export function makeCounter(overrides: MessageInitShape<typeof ServerInfo_CounterSchema> = {}): ServerInfo_Counter {
  return create(ServerInfo_CounterSchema, {
    id: 1,
    name: 'Life',
    counterColor: create(colorSchema, { r: 0, g: 0, b: 0, a: 255 }),
    radius: 1,
    count: 20,
    ...overrides,
  });
}

export function makeArrow(overrides: MessageInitShape<typeof ServerInfo_ArrowSchema> = {}): ServerInfo_Arrow {
  return create(ServerInfo_ArrowSchema, {
    id: 1,
    startPlayerId: 1,
    startZone: 'table',
    startCardId: 1,
    targetPlayerId: 1,
    targetZone: 'table',
    arrowColor: create(colorSchema, { r: 255, g: 0, b: 0, a: 255 }),
    targetCardId: 2,
    ...overrides,
  });
}

type ZoneEntryOverrides = Partial<Enriched.ZoneEntry> & {
  cards?: ServerInfo_Card[];
};

export function makeZoneEntry(overrides: ZoneEntryOverrides = {}): Enriched.ZoneEntry {
  const { cards, order, byId, ...rest } = overrides;
  let resolvedOrder: number[] = order ?? [];
  let resolvedById: { [id: number]: ServerInfo_Card } = byId ?? {};
  if (cards !== undefined) {
    resolvedOrder = cards.map(c => c.id);
    resolvedById = {};
    for (const c of cards) {
      resolvedById[c.id] = c;
    }
  }
  return {
    name: 'hand',
    type: 1,
    withCoords: false,
    cardCount: 0,
    order: resolvedOrder,
    byId: resolvedById,
    alwaysRevealTopCard: false,
    alwaysLookAtTopCard: false,
    ...rest,
  };
}

export function makePlayerProperties(
  overrides: MessageInitShape<typeof ServerInfo_PlayerPropertiesSchema> = {},
): ServerInfo_PlayerProperties {
  return create(ServerInfo_PlayerPropertiesSchema, {
    playerId: 1,
    spectator: false,
    conceded: false,
    readyStart: false,
    deckHash: '',
    pingSeconds: 0,
    sideboardLocked: false,
    judge: false,
    ...overrides,
  });
}

export function makePlayerEntry(overrides: Partial<Enriched.PlayerEntry> = {}): Enriched.PlayerEntry {
  return {
    properties: makePlayerProperties(),
    deckList: '',
    zones: {
      hand: makeZoneEntry({ name: 'hand' }),
      deck: makeZoneEntry({ name: 'deck' }),
    },
    counters: {},
    arrows: {},
    ...overrides,
  };
}

export function makeGameInfo(
  overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {},
): ServerInfo_Game {
  return create(ServerInfo_GameSchema, {
    gameId: 1,
    roomId: 1,
    description: 'Test Game',
    gameTypes: [],
    started: false,
    ...overrides,
  });
}

export function makeGameEntry(overrides: Partial<Enriched.GameEntry> = {}): Enriched.GameEntry {
  return {
    info: makeGameInfo(),
    hostId: 1,
    localPlayerId: 1,
    spectator: false,
    judge: false,
    resuming: false,
    started: false,
    activePlayerId: 0,
    activePhase: 0,
    secondsElapsed: 0,
    reversed: false,
    players: {
      1: makePlayerEntry(),
    },
    messages: [],
    ...overrides,
  };
}

export function makeState(overrides: Partial<GamesState> = {}): GamesState {
  return {
    games: {
      1: makeGameEntry(),
    },
    ...overrides,
  };
}
