import { ZoneName } from '@cockatrice/sockatrice';
import { CardAttribute } from '@cockatrice/sockatrice/generated';
import { games, type GamesState } from '@cockatrice/datatrice';

import { PHASE_SOUNDS, type SoundName } from '@app/services';

export interface ObservedAction {
  type: string | null;
  payload: unknown;
}

const T = games.Types;
const PROPERTIES_UPDATED = games.Actions.playerPropertiesUpdated.type;

const DISCONNECTED_PING = -1;

type Payload = { gameId: number; playerId: number };

export function gameEventSound(action: ObservedAction, before: GamesState, after: GamesState): SoundName | null {
  const payload = action.payload as Payload & Record<string, unknown>;
  switch (action.type) {
    case T.ACTIVE_PHASE_SET:
      return PHASE_SOUNDS[(payload as unknown as { phase: number }).phase] ?? null;

    case T.CARDS_DRAWN:
      return 'draw_card';

    case T.CARD_MOVED:
      return moveSound(payload);

    case T.CARD_ATTR_CHANGED: {
      const { attribute, attrValue } = payload.data as { attribute?: number; attrValue?: string };
      if (attribute !== CardAttribute.AttrTapped) {
        return null;
      }
      return attrValue === '1' ? 'tap_card' : 'untap_card';
    }

    case T.ZONE_SHUFFLED:
      return 'shuffle';

    case T.DIE_ROLLED:
      return 'roll_dice';

    case T.COUNTER_SET: {
      const { counterId } = payload.data as { counterId: number };
      const counter = before.games[payload.gameId]?.players[payload.playerId]?.counters[counterId];
      return counter?.name === 'life' ? 'life_change' : null;
    }

    case T.PLAYER_JOINED: {
      const { playerProperties } = payload as unknown as { playerProperties: { playerId: number; spectator: boolean } };
      if (before.games[payload.gameId]?.players[playerProperties.playerId]) {
        return null;
      }
      return playerProperties.spectator ? 'spectator_join' : 'player_join';
    }

    case T.PLAYER_LEFT: {
      const leaver = before.games[payload.gameId]?.players[payload.playerId];
      if (!leaver) {
        return null;
      }
      return leaver.properties.spectator ? 'spectator_leave' : 'player_leave';
    }

    case PROPERTIES_UPDATED:
      return propertiesSound(payload, before, after);

    default:
      return null;
  }
}

function moveSound(payload: Payload & Record<string, unknown>): SoundName | null {
  const { startPlayerId, startZone, targetPlayerId, targetZone } = payload.data as {
    startPlayerId: number;
    startZone: string;
    targetPlayerId: number;
    targetZone: string;
  };
  const target = targetZone || startZone;
  const ownerChanged = targetPlayerId >= 0 && startPlayerId >= 0 && targetPlayerId !== startPlayerId;
  if (ownerChanged && startPlayerId === payload.playerId) {
    return null;
  }
  if (target === ZoneName.TABLE) {
    return startZone === ZoneName.TABLE && !ownerChanged ? null : 'play_card';
  }
  return target === ZoneName.STACK ? 'play_card' : null;
}

function propertiesSound(payload: Payload, before: GamesState, after: GamesState): SoundName | null {
  const { gameId, playerId } = payload;
  const was = before.games[gameId]?.players[playerId]?.properties;
  const now = after.games[gameId]?.players[playerId]?.properties;
  if (was && now && Boolean(was.conceded) !== Boolean(now.conceded)) {
    return 'player_concede';
  }
  const pingBefore = before.pings[gameId]?.[playerId];
  const pingAfter = after.pings[gameId]?.[playerId];
  if (pingBefore == null || pingAfter == null || pingBefore === pingAfter) {
    return null;
  }
  if (pingAfter === DISCONNECTED_PING) {
    return 'player_disconnect';
  }
  return pingBefore === DISCONNECTED_PING ? 'player_reconnect' : null;
}

const ATTENTION_EVENTS: ReadonlySet<string> = new Set([
  T.GAME_STATE_CHANGED, T.GAME_CLOSED, T.KICKED, T.PLAYER_JOINED, T.PLAYER_LEFT,
  T.CARD_MOVED, T.CARD_FLIPPED, T.CARD_DESTROYED, T.CARD_ATTACHED, T.TOKEN_CREATED, T.CARD_ATTR_CHANGED,
  T.CARD_COUNTER_CHANGED, T.ARROW_CREATED, T.ARROW_DELETED, T.COUNTER_CREATED, T.COUNTER_SET, T.COUNTER_DELETED,
  T.CARDS_DRAWN, T.CARDS_REVEALED, T.ZONE_SHUFFLED, T.DIE_ROLLED, T.ACTIVE_PLAYER_SET, T.ACTIVE_PHASE_SET,
  T.TURN_REVERSED, T.ZONE_DUMPED, T.ZONE_PROPERTIES_CHANGED, T.GAME_SAY,
]);

export const isGameAttentionEvent = (type: string | null): boolean => type != null && ATTENTION_EVENTS.has(type);
