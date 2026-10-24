import { useMemo } from 'react';

import { games, type GameEntry, type PlayerEntry } from '@cockatrice/datatrice';
import { ZoneName } from '@cockatrice/sockatrice';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { useAppSelector } from '@app/store';

export interface PreviewCard {
  id: number;
  name: string;
  providerId: string;
  tapped: boolean;
  faceDown: boolean;
  counters: number;
  attached: boolean;
}

export interface PreviewSeat {
  playerId: number;
  name: string | undefined;
  life: number | undefined;
  handCount: number;
  libraryCount: number;
  battlefield: PreviewCard[];
  isActive: boolean;
}

export interface PreviewBoardModel {
  seats: PreviewSeat[];
  activePlayerName: string | undefined;
  phase: number | undefined;
  stack: string[];
}

const EMPTY_MODEL: PreviewBoardModel = { seats: [], activePlayerName: undefined, phase: undefined, stack: [] };

function isLifeCounter(name: string): boolean {
  return name.trim().toLowerCase() === 'life';
}

function toPreviewCard(card: ServerInfo_Card): PreviewCard {
  return {
    id: card.id,
    name: card.name,
    providerId: card.providerId,
    tapped: card.tapped,
    faceDown: card.faceDown,
    counters: card.counterList.reduce((sum, counter) => sum + counter.value, 0),
    attached: card.attachCardId != null && card.attachCardId !== -1,
  };
}

function zoneCards(player: PlayerEntry, zoneName: string): ServerInfo_Card[] {
  const zone = player.zones[zoneName];
  return zone ? zone.order.map((id) => zone.byId[id]).filter((card) => card != null) : [];
}

export function buildPreviewBoardModel(game: GameEntry | undefined): PreviewBoardModel {
  if (!game) {
    return EMPTY_MODEL;
  }
  const seated = games.seatedPlayersOf(game);
  const seats = seated.map<PreviewSeat>((player) => {
    const life = Object.values(player.counters).find((counter) => isLifeCounter(counter.name))?.count;
    return {
      playerId: player.properties.playerId,
      name: player.properties.userInfo?.name,
      life,
      handCount: player.zones[ZoneName.HAND]?.cardCount ?? 0,
      libraryCount: player.zones[ZoneName.DECK]?.cardCount ?? 0,
      battlefield: zoneCards(player, ZoneName.TABLE).map(toPreviewCard),
      isActive: player.properties.playerId === game.activePlayerId,
    };
  });
  const stack = seated.flatMap((player) => zoneCards(player, ZoneName.STACK).map((card) => card.name));
  return {
    seats,
    activePlayerName: seats.find((seat) => seat.isActive)?.name,
    phase: game.activePhase >= 0 ? game.activePhase : undefined,
    stack,
  };
}

export function usePreviewBoardModel(gameId: number | undefined): PreviewBoardModel {
  const game = useAppSelector((state) => (gameId != null ? games.Selectors.getGame(state, gameId) : undefined));
  return useMemo(() => buildPreviewBoardModel(game), [game]);
}
