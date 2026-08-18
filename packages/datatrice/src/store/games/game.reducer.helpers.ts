import type { ZoneNameValue } from '@cockatrice/sockatrice';
import { create } from '@bufbuild/protobuf';
import { Enriched } from '../../types';
import {
  ServerInfo_Arrow,
  ServerInfo_Card,
  ServerInfo_CardSchema,
  ServerInfo_Counter,
  ServerInfo_Player,
} from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common';
import type { LogEntry } from './messageLog';

export const MAX_GAME_MESSAGES = 1000;

const LEAVE_REASON_MESSAGES: Record<number, string> = {
  1: 'reason unknown',
  2: 'kicked by game host or moderator',
  3: 'player left the game',
  4: 'player disconnected from server',
};

export function formatLeaveMessage(playerName: string, reason: number): LogEntry {
  const reasonText = LEAVE_REASON_MESSAGES[reason] ?? LEAVE_REASON_MESSAGES[1];
  return {
    text: `${playerName} has left the game (${reasonText}).`,
    segments: [
      { text: playerName, kind: 'player' },
      { text: ` has left the game (${reasonText}).`, kind: 'plain' },
    ],
  };
}

export function eventTimestamp(): number {
  return Date.now();
}

/**
 * Push a formatted game event onto the log. Accepts a plain string for
 * legacy paths (chat, ad-hoc system messages) or a `LogEntry` from the
 * `formatX(...)` helpers — the latter carries per-token segments so
 * the chat renderer can highlight card names / player names / numbers.
 */
export function pushEventMessage(
  game: Enriched.GameEntry,
  playerId: number,
  message: string | LogEntry | null | undefined,
): void {
  if (!message) {
    return;
  }
  const text = typeof message === 'string' ? message : message.text;
  const segments = typeof message === 'string' ? undefined : message.segments;
  if (!text) {
    return;
  }
  if (game.messages.length >= MAX_GAME_MESSAGES) {
    game.messages = game.messages.slice(game.messages.length - MAX_GAME_MESSAGES + 1);
  }
  game.messages.push({
    playerId,
    message: text,
    segments,
    timeReceived: eventTimestamp(),
    kind: 'event',
  });
}

export function normalizePlayers(playerList: ServerInfo_Player[]): { [playerId: number]: Enriched.PlayerEntry } {
  const players: { [playerId: number]: Enriched.PlayerEntry } = {};
  for (const player of playerList) {
    const playerId = player.properties.playerId;

    const zones: { [zoneName: string]: Enriched.ZoneEntry } = {};
    for (const zone of player.zoneList) {
      const order: number[] = [];
      const byId: { [id: number]: ServerInfo_Card } = {};
      for (const card of zone.cardList) {
        order.push(card.id);
        byId[card.id] = card;
      }
      zones[zone.name] = {
        name: zone.name as ZoneNameValue,
        type: zone.type,
        withCoords: zone.withCoords,
        cardCount: zone.cardCount,
        order,
        byId,
        alwaysRevealTopCard: zone.alwaysRevealTopCard,
        alwaysLookAtTopCard: zone.alwaysLookAtTopCard,
      };
    }

    const counters: { [counterId: number]: ServerInfo_Counter } = {};
    for (const counter of player.counterList) {
      counters[counter.id] = counter;
    }

    const arrows: { [arrowId: number]: ServerInfo_Arrow } = {};
    for (const arrow of player.arrowList) {
      arrows[arrow.id] = arrow;
    }

    players[playerId] = {
      properties: player.properties,
      deckList: player.deckList,
      zones,
      counters,
      arrows,
      drawSeq: 0,
      lastDrawCount: 0,
    };
  }
  return players;
}

export function buildEmptyCard(
  id: number,
  name: string,
  x: number,
  y: number,
  faceDown: boolean,
  providerId: string
): ServerInfo_Card {
  return create(ServerInfo_CardSchema, {
    id, name, x, y, faceDown,
    tapped: false, attacking: false, color: '', pt: '', annotation: '',
    destroyOnZoneChange: false, doesntUntap: false, counterList: [],
    attachPlayerId: -1, attachZone: '', attachCardId: -1, providerId,
  });
}

// Port of Cockatrice's `Server_Card::resetState(bool keepAnnotations)`
// (server_card.cpp:51-61). Wipes battlefield-only transient state when
// a card leaves the table. Servatrice keeps annotations ONLY when the
// target zone is the STACK — `keepAnnotations = (targetzone->getName()
// == ZoneNames::STACK)` at the call site in
// server_abstract_player.cpp:429. Every other non-battlefield target
// (hand, deck, graveyard, exile) clears them.
export function resetCardState(
  card: ServerInfo_Card,
  keepAnnotations: boolean = false,
): ServerInfo_Card {
  return cloneWith(ServerInfo_CardSchema, card, {
    tapped: false,
    attacking: false,
    doesntUntap: false,
    pt: '',
    color: '',
    annotation: keepAnnotations ? card.annotation : '',
    counterList: [],
  });
}

// Drops a zone's known-card tracking — the revealed identities (`byId`/`order`), any open
// "View library" snapshot, and the auto-revealed top-card face — while preserving the
// authoritative `cardCount`. Used when a shuffle randomizes a hidden zone: any previously-
// known card positions are now meaningless, so the client must stop rendering a stale top
// card or leaking cards moved in before the shuffle. If auto-reveal is still on, Servatrice
// re-emits Event_RevealCards immediately after the shuffle (revealTopCardIfNeeded at
// server_abstract_player.cpp:329-333) and the cardsRevealed reducer re-populates
// topRevealedCard with the new top — so the pile briefly flashes blank and then repopulates.
export function clearZoneKnownCards(zone: Enriched.ZoneEntry): void {
  zone.order = [];
  zone.byId = {};
  delete zone.revealedCards;
  delete zone.topRevealedCard;
}
