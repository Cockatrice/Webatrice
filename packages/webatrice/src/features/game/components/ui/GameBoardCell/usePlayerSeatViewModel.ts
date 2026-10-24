import { useMemo } from 'react';
import { lruMemoize } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { games, type PlayerEntry } from '@cockatrice/datatrice';
import { ZoneName, isBuiltinZone } from '@cockatrice/sockatrice';
import type { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { parseCod } from '@app/services';
import { useAppSelector } from '@app/store';

import type { BoardCell } from '../../../hooks/useGameBoardLayout';
import { avatarSrc } from '../../../utils/avatarSrc';
import { useGameId } from '../GameIdContext';
import { isHiddenZone } from '../../../utils/zones';
import type {
  BattlefieldCardViewModel,
  HandPlacement,
  ManaSymbol,
  PlayerBoardModel,
  PlayerCardViewModel,
  PlayerCounterViewModel,
  SeatDeckCard,
} from '../PlayerBoard/playerBoard.types';

// Life is just a counter named "life" (case-insensitive) in Cockatrice's
// protocol — no special-cased life field on players.
function isLifeCounter(c: { name: string }): boolean {
  return c.name.trim().toLowerCase() === 'life';
}

const MANA_SYMBOL_BY_WIRE_NAME: Record<string, ManaSymbol> = {
  w: 'W',
  u: 'U',
  b: 'B',
  r: 'R',
  g: 'G',
  x: 'C',
  storm: 'O',
};

const EMPTY_CARDS: PlayerCardViewModel[] = [];
const EMPTY_BATTLEFIELD_CARDS: BattlefieldCardViewModel[] = [];
const EMPTY_DECK: SeatDeckCard[] = [];

type ZoneCards = { order: number[]; byId: Record<number, ServerInfo_Card> };
type ForeignCard = { id: number; card: ServerInfo_Card; ownerPlayerId: number };

function foreignCardsOf(playerId: number, allPlayers: Record<number, PlayerEntry> | undefined): ForeignCard[] {
  const cards: ForeignCard[] = [];
  for (const [ownerIdStr, otherPlayer] of Object.entries(allPlayers ?? {})) {
    const ownerPlayerId = Number(ownerIdStr);
    const table = otherPlayer.zones[ZoneName.TABLE];
    if (ownerPlayerId === playerId || !table) {
      continue;
    }
    for (const id of table.order) {
      const card = table.byId[id];
      if (card && card.attachCardId >= 0 && card.attachZone === ZoneName.TABLE && card.attachPlayerId === playerId) {
        cards.push({ id, card, ownerPlayerId });
      }
    }
  }
  return cards;
}

export function zoneToSeatCards(zone: ZoneCards | undefined): PlayerCardViewModel[] {
  if (!zone) {
    return EMPTY_CARDS;
  }
  return zone.order.map((id) => {
    const card = zone.byId[id];
    return {
      id: String(id),
      name: card?.name ?? '',
      scryfallId: card?.providerId ?? '',
      annotation: card?.annotation || undefined,
    };
  });
}

export function seatDisplayName(t: TFunction, realName: string | undefined, isLocal: boolean, playerId: number): string {
  return realName ?? (isLocal ? t('PlayerBoard.you') : t('GameLog.player.number', { id: playerId }));
}

export function revealedCardsToSeatCards(
  cards: readonly { id: number; name: string; providerId: string }[] | undefined,
): PlayerCardViewModel[] {
  if (!cards || cards.length === 0) {
    return EMPTY_CARDS;
  }
  return cards.map((c, idx) => ({
    id: String(c.id ?? idx),
    name: c.name ?? '',
    scryfallId: c.providerId ?? '',
  }));
}

export function projectBattlefieldCard(
  id: number,
  card: ServerInfo_Card | undefined,
  ownerPlayerId: number,
): BattlefieldCardViewModel {
  const wireX = Math.max(0, card?.x ?? 0);
  const attachCardId = card?.attachCardId ?? -1;
  const attachPlayerId = card?.attachPlayerId ?? -1;
  return {
    id: String(id),
    ownerPlayerId,
    name: card?.name ?? '',
    scryfallId: card?.providerId ?? '',
    slot: {
      row: Math.max(0, card?.y ?? 0),
      col: Math.floor(wireX / 3),
    },
    subSlot: wireX % 3,
    tapped: card?.tapped ?? false,
    faceDown: card?.faceDown ?? false,
    pt: card?.pt || undefined,
    doesntUntap: card?.doesntUntap ?? false,
    color: card?.color || undefined,
    annotation: card?.annotation || undefined,
    attachTargetCardId: attachCardId >= 0 ? attachCardId : undefined,
    attachTargetPlayerId: attachCardId >= 0 ? attachPlayerId : undefined,
    counters: card?.counterList,
  };
}

export function projectBattlefield(
  playerId: number,
  tableZone: ZoneCards | undefined,
  foreignCards: readonly ForeignCard[],
): BattlefieldCardViewModel[] {
  const own = tableZone
    ? tableZone.order.reduce<BattlefieldCardViewModel[]>((acc, id) => {
      const c = tableZone.byId[id];
      const attachCardId = c?.attachCardId ?? -1;
      const attachPlayerId = c?.attachPlayerId ?? -1;
      const attachZone = c?.attachZone ?? '';
      const attachedElsewhere =
        attachCardId >= 0
        && attachZone === ZoneName.TABLE
        && attachPlayerId !== playerId;
      if (!attachedElsewhere) {
        acc.push(projectBattlefieldCard(id, c, playerId));
      }
      return acc;
    }, [])
    : EMPTY_BATTLEFIELD_CARDS;

  const foreignChildren = foreignCards.map(({ id, card, ownerPlayerId }) => projectBattlefieldCard(id, card, ownerPlayerId));
  return foreignChildren.length === 0 ? own : own.concat(foreignChildren);
}

function projectCounters(
  countersMap: Record<number, { id: number; name: string; count: number }> | undefined,
): PlayerCounterViewModel {
  if (!countersMap) {
    return { life: undefined, mana: undefined };
  }
  const counters = Object.values(countersMap);
  const life = counters.find(isLifeCounter);
  const mana: Partial<Record<ManaSymbol, { id: number; count: number }>> = {};
  for (const c of counters) {
    const symbol = MANA_SYMBOL_BY_WIRE_NAME[c.name.trim().toLowerCase()];
    if (symbol) {
      mana[symbol] = { id: c.id, count: c.count };
    }
  }
  return {
    life: life ? { id: life.id, value: life.count } : undefined,
    mana,
  };
}

export function deckListToSeatDeck(deckList: string | undefined): readonly SeatDeckCard[] {
  if (!deckList) {
    return EMPTY_DECK;
  }
  try {
    return parseCod(deckList).cards.map((c) => ({
      name: c.name,
      scryfallId: c.scryfallId ?? '',
      sideboard: c.category === 'sideboard',
      commander: c.isCommander === true,
    }));
  } catch {
    return EMPTY_DECK;
  }
}

export function handPlacementOf(cell: Pick<BoardCell, 'isLocal' | 'showHand'>): HandPlacement {
  if (cell.showHand) {
    return 'inline';
  }
  return cell.isLocal ? 'tray' : 'hidden';
}

export function usePlayerSeatViewModel(cell: BoardCell, totalPlayers: number): PlayerBoardModel {
  const { t } = useTranslation();
  const gameId = useGameId();
  const { playerId, isLocal, mirrored, canAct } = cell;
  const handPlacement = handPlacementOf(cell);

  const player = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayer(state, gameId, playerId) : undefined,
  );
  const countersMap = useAppSelector((state) =>
    gameId != null ? games.Selectors.getCounters(state, gameId, playerId) : undefined,
  );
  const activePlayerId = useAppSelector((state) =>
    gameId != null ? games.Selectors.getActivePlayerId(state, gameId) : undefined,
  );
  const selectRevealTargets = useMemo(() => lruMemoize(
    (seatedPlayers: PlayerEntry[] | undefined) =>
      (seatedPlayers ?? [])
        .filter((p) => p.properties.playerId !== playerId)
        .map((p) => ({
          playerId: p.properties.playerId,
          name: p.properties.userInfo?.name ?? t('GameLog.player.number', { id: p.properties.playerId }),
        })),
    { resultEqualityCheck: (a, b) => a.length === b.length
      && a.every((target, i) => target.playerId === b[i].playerId && target.name === b[i].name) },
  ), [playerId, t]);
  const revealTargets = useAppSelector((state) => selectRevealTargets(
    gameId != null ? games.Selectors.getSeatedPlayers(state, gameId) : undefined,
  ));
  const selectForeignCards = useMemo(() => lruMemoize(
    (players: Record<number, PlayerEntry> | undefined) => foreignCardsOf(playerId, players),
    { resultEqualityCheck: (a, b) => a.length === b.length
      && a.every((entry, i) => entry.id === b[i].id && entry.card === b[i].card && entry.ownerPlayerId === b[i].ownerPlayerId) },
  ), [playerId]);
  const foreignCards = useAppSelector((state) => selectForeignCards(
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  ));

  const realName = player?.properties.userInfo?.name;
  const avatarBmp = player?.properties.userInfo?.avatarBmp;
  const avatarUrl = useMemo(() => avatarSrc(avatarBmp), [avatarBmp]);
  const hydrated = player != null;
  const isActive = hydrated && playerId === activePlayerId;
  const flipHandCardBacks = totalPlayers !== 3;
  const drawSeq = player?.drawSeq ?? 0;
  const lastDrawCount = player?.lastDrawCount ?? 0;

  const seat = useMemo(
    () => ({
      playerId,
      hydrated,
      isLocal,
      mirrored,
      handPlacement,
      isActive,
      displayName: seatDisplayName(t, realName, isLocal, playerId),
      username: realName ?? (isLocal ? 'you' : `player-${playerId}`),
      avatarUrl,
      flipHandCardBacks,
      drawSeq,
      lastDrawCount,
      revealTargets,
    }),
    [
      playerId, hydrated, isLocal, mirrored, handPlacement, isActive, realName, avatarUrl,
      flipHandCardBacks, drawSeq, lastDrawCount, revealTargets, t,
    ],
  );

  const deckList = player?.deckList;
  const deck = useMemo(() => deckListToSeatDeck(deckList), [deckList]);
  const counters = useMemo(() => projectCounters(countersMap), [countersMap]);
  const permissions = useMemo(() => ({ isOwner: isLocal, canAct }), [isLocal, canAct]);

  const handZone = player?.zones[ZoneName.HAND];
  const deckZone = player?.zones[ZoneName.DECK];
  const graveZone = player?.zones[ZoneName.GRAVE];
  const exileZone = player?.zones[ZoneName.EXILE];
  const stackZone = player?.zones[ZoneName.STACK];
  const tableZone = player?.zones[ZoneName.TABLE];
  const sideboardZone = player?.zones[ZoneName.SIDEBOARD];

  const hand = useMemo(
    () => ({ cards: zoneToSeatCards(handZone), cardCount: handZone?.cardCount }),
    [handZone],
  );
  const graveyard = useMemo(
    () => ({ cards: zoneToSeatCards(graveZone), cardCount: graveZone?.cardCount }),
    [graveZone],
  );
  const exile = useMemo(
    () => ({ cards: zoneToSeatCards(exileZone), cardCount: exileZone?.cardCount }),
    [exileZone],
  );
  const stack = useMemo(
    () => ({ cards: zoneToSeatCards(stackZone), cardCount: stackZone?.cardCount }),
    [stackZone],
  );
  const library = useMemo(() => {
    const top = deckZone?.topRevealedCard;
    return {
      cardCount: deckZone?.cardCount,
      revealedCards: revealedCardsToSeatCards(deckZone?.revealedCards),
      topCard: top ? { name: top.name, scryfallId: top.providerId } : null,
      alwaysRevealTopCard: deckZone?.alwaysRevealTopCard ?? false,
      alwaysLookAtTopCard: deckZone?.alwaysLookAtTopCard ?? false,
    };
  }, [deckZone]);
  const sideboardCount = sideboardZone?.cardCount;
  const sideboardRevealed = sideboardZone?.revealedCards;
  const sideboard = useMemo(
    () => ({
      cardCount: sideboardCount,
      revealedCards: revealedCardsToSeatCards(sideboardRevealed),
    }),
    [sideboardCount, sideboardRevealed],
  );
  const battlefield = useMemo(
    () => ({ cards: projectBattlefield(playerId, tableZone, foreignCards) }),
    [playerId, tableZone, foreignCards],
  );

  const allZones = player?.zones;
  const customZones = useMemo(
    () => Object.values(allZones ?? {})
      .filter((z) => !isBuiltinZone(z.name))
      .map((z) => ({
        name: z.name, type: z.type, withCoords: z.withCoords, cardCount: z.cardCount,
        cards: isHiddenZone(z) ? revealedCardsToSeatCards(z.revealedCards) : zoneToSeatCards(z),
      })),
    [allZones],
  );

  const zones = useMemo(
    () => ({ hand, library, graveyard, exile, stack, battlefield, sideboard, customZones }),
    [hand, library, graveyard, exile, stack, battlefield, sideboard, customZones],
  );

  return useMemo(
    () => ({ seat, deck, zones, counters, permissions }),
    [seat, deck, zones, counters, permissions],
  );
}
