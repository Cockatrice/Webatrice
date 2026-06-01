import type {
  Event_RoomSay,
  ServerInfo_Arrow,
  ServerInfo_Card,
  ServerInfo_ChatMessage,
  ServerInfo_Counter,
  ServerInfo_Game,
  ServerInfo_PlayerProperties,
  ServerInfo_Room,
  ServerInfo_User,
} from '@cockatrice/sockatrice/generated';

// @critical `info` is the wire snapshot; repeated collections on it go stale. Read normalized siblings.
// See .github/instructions/datatrice-store.instructions.md#data-structure-invariants.

export interface GametypeMap { [index: number]: string }

export interface Room {
  info: ServerInfo_Room;
  gametypeMap: GametypeMap;
  order: number;
  games: { [gameId: number]: Game };
  users: { [userName: string]: ServerInfo_User };
}

export interface Game {
  info: ServerInfo_Game;
  gameType: string;
}

export type Message = Event_RoomSay & {
  timeReceived: number;
};

// @critical `info` = wire snapshot at join time; top-level twins hold live values updated by game events.
// See .github/instructions/datatrice-store.instructions.md#data-structure-invariants.
export interface GameEntry {
  info: ServerInfo_Game;

  hostId: number;
  localPlayerId: number;
  spectator: boolean;
  judge: boolean;
  resuming: boolean;

  started: boolean;
  activePlayerId: number;
  activePhase: number;
  secondsElapsed: number;
  reversed: boolean;

  players: { [playerId: number]: PlayerEntry };
  messages: GameMessage[];
}

export interface PlayerEntry {
  properties: ServerInfo_PlayerProperties;
  deckList: string;
  zones: { [zoneName: string]: ZoneEntry };
  counters: { [counterId: number]: ServerInfo_Counter };
  arrows: { [arrowId: number]: ServerInfo_Arrow };
}

// Canonical wire values for `ZoneEntry.name`. Server-defined and stable.
export const ZoneName = {
  TABLE: 'table',
  GRAVE: 'grave',
  EXILE: 'rfg',
  HAND: 'hand',
  DECK: 'deck',
  SIDEBOARD: 'sb',
  STACK: 'stack',
} as const;

export type ZoneNameValue = typeof ZoneName[keyof typeof ZoneName];

export interface ZoneEntry {
  name: ZoneNameValue;
  type: number;
  withCoords: boolean;
  // Hidden zones: cardCount may exceed order.length.
  cardCount: number;
  order: number[];
  byId: { [cardId: number]: ServerInfo_Card };
  alwaysRevealTopCard: boolean;
  alwaysLookAtTopCard: boolean;
  // Transient dump-zone view (e.g. "View library"): the face-up card list returned by
  // Response_DumpZone. Kept apart from byId/order because HiddenZone dumps reference cards
  // by list index (0..N-1), which would collide with real card ids. Cleared when the view closes.
  revealedCards?: ServerInfo_Card[];
}

export interface GameMessage {
  playerId: number;
  message: string;
  timeReceived: number;
  kind?: 'chat' | 'event';
}

export interface LogGroups {
  room: ServerInfo_ChatMessage[];
  game: ServerInfo_ChatMessage[];
  chat: ServerInfo_ChatMessage[];
}
