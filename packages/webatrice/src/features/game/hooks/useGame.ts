import { RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { createCardRegistry, makeCardKey, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { useCurrentGame, type CurrentGame } from './useCurrentGame';
import { useGameAccess, type GameAccess } from './useGameAccess';
import { useGameArrowInteractions, type GameArrowInteractions } from './useGameArrowInteractions';
import { useGameDialogs, type GameDialogs } from './useGameDialogs';
import { useGameDnd, type GameDnd } from './useGameDnd';
import { useGameLifecycleNavigation } from './useGameLifecycleNavigation';
import { useGamePlayerSlots, type GamePlayerSlots } from './useGamePlayerSlots';
import { useGameShortcuts } from './useGameShortcuts';

export interface Game extends CurrentGame {
  boardRef: RefObject<HTMLDivElement>;
  gameRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
  sensors: ReturnType<typeof useSensors>;
  hoveredCard: ServerInfo_Card | null;
  setHoveredCard: (card: ServerInfo_Card | null) => void;
  previewCard: ServerInfo_Card | null;
  selectedCardKey: string | null;
  onCardFocus: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardBlur: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  localAccess: GameAccess;
  slotAAccess: GameAccess;
  slotBAccess: GameAccess;
  deckSelectOpen: boolean;
  showSlotAHand: boolean;
  showSlotBHand: boolean;
  slots: GamePlayerSlots;
  arrows: GameArrowInteractions;
  dialogs: GameDialogs;
  dnd: GameDnd;
}

export function useGame(): Game {
  const params = useParams<{ gameId?: string }>();
  const parsed = params.gameId != null ? Number(params.gameId) : NaN;
  const routeGameId = Number.isFinite(parsed) ? parsed : undefined;
  const current = useCurrentGame(routeGameId);
  const { gameId, game, localPlayer, isSpectator } = current;

  useGameLifecycleNavigation(gameId);

  const boardRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const cardRegistry = useMemo(() => createCardRegistry(), []);
  // See .github/instructions/webatrice-game.instructions.md#pointer--click-vs-drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 0 } }),
    useSensor(KeyboardSensor),
  );
  const [hoveredCard, setHoveredCard] = useState<ServerInfo_Card | null>(null);
  const [selection, setSelection] = useState<{ key: string; card: ServerInfo_Card } | null>(null);

  const onCardFocus = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (ownerPlayerId == null || zone == null) {
        return;
      }
      setSelection({ key: makeCardKey(ownerPlayerId, zone, card.id), card });
    },
    [],
  );
  const onCardBlur = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (ownerPlayerId == null || zone == null) {
        return;
      }
      const blurredKey = makeCardKey(ownerPlayerId, zone, card.id);
      // Defer so a sibling card's focus (which fires after blur) wins.
      queueMicrotask(() => {
        setSelection((prev) => (prev?.key === blurredKey ? null : prev));
      });
    },
    [],
  );
  const previewCard = selection?.card ?? hoveredCard;
  const selectedCardKey = selection?.key ?? null;

  const slots = useGamePlayerSlots(game);
  const localAccess = useGameAccess(gameId, game?.localPlayerId);
  const slotAAccess = useGameAccess(gameId, slots.slotAPlayerId);
  const slotBAccess = useGameAccess(gameId, slots.slotBPlayerId);

  const arrows = useGameArrowInteractions({ gameId, game, containerRef: gameRef, cardRegistry });
  const dialogs = useGameDialogs({
    gameId,
    game,
    localPlayer,
    localAccess,
    isSpectator,
    startPendingArrow: arrows.startPendingArrow,
    startPendingAttach: arrows.startPendingAttach,
  });
  const dnd = useGameDnd({ gameId });

  useGameShortcuts({ gameId, onRequestConcede: dialogs.openConcede });

  // localPlayer null-check guards the reconnect window before Event_GameStateChanged repopulates players.
  const deckSelectOpen =
    game != null &&
    localPlayer != null &&
    !game.started &&
    !current.isSpectator &&
    !current.isJudge &&
    !localPlayer.properties.readyStart;

  // A seated player always sees their own hand. Other hands render only when
  // the server has marked the game omniscient (spectators_see_everything),
  // which is what gates whether the server sends face-up cards in the first place.
  const omniscient = game?.info?.spectatorsOmniscient === true;
  const isOwnSeat = (pid: number | null | undefined) =>
    !isSpectator && pid != null && game != null && pid === game.localPlayerId;
  const showSlotAHand =
    game != null &&
    slots.slotAPlayerId != null &&
    (isOwnSeat(slots.slotAPlayerId) || omniscient);
  const showSlotBHand =
    game != null &&
    slots.slotBPlayerId != null &&
    (isOwnSeat(slots.slotBPlayerId) || omniscient);

  return {
    ...current,
    boardRef,
    gameRef,
    cardRegistry,
    sensors,
    hoveredCard,
    setHoveredCard,
    previewCard,
    selectedCardKey,
    onCardFocus,
    onCardBlur,
    localAccess,
    slotAAccess,
    slotBAccess,
    deckSelectOpen,
    showSlotAHand,
    showSlotBHand,
    slots,
    arrows,
    dialogs,
    dnd,
  };
}
