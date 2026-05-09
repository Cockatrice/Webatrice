import { RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { createCardRegistry, type CardRegistry } from '@app/components';
import { useCurrentGame, useGameAccess, type CurrentGame, type GameAccess } from '@app/hooks';
import type { Data } from '@app/types';

import { useGameArrowInteractions, type GameArrowInteractions } from './useGameArrowInteractions';
import { useGameDialogs, type GameDialogs } from './useGameDialogs';
import { useGameDnd, type GameDnd } from './useGameDnd';
import { useGameLifecycleNavigation } from './useGameLifecycleNavigation';
import { useGamePlayerSlots, type GamePlayerSlots } from './useGamePlayerSlots';

export interface Game extends CurrentGame {
  boardRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
  sensors: ReturnType<typeof useSensors>;
  hoveredCard: Data.ServerInfo_Card | null;
  setHoveredCard: (card: Data.ServerInfo_Card | null) => void;
  isRotated: boolean;
  toggleRotated: () => void;
  localAccess: GameAccess;
  slotAAccess: GameAccess;
  slotBAccess: GameAccess;
  deckSelectOpen: boolean;
  showHandZone: boolean;
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
  const cardRegistry = useMemo(() => createCardRegistry(), []);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [hoveredCard, setHoveredCard] = useState<Data.ServerInfo_Card | null>(null);
  // View-only 90° rotation; local to this tab, mirrors desktop's
  // Player::actRotateLocal which applies a QGraphicsView transform with no
  // server call.
  const [isRotated, setIsRotated] = useState(false);
  const toggleRotated = useCallback(() => setIsRotated((prev) => !prev), []);

  const slots = useGamePlayerSlots(game);
  const localAccess = useGameAccess(gameId, game?.localPlayerId);
  const slotAAccess = useGameAccess(gameId, slots.slotAPlayerId);
  const slotBAccess = useGameAccess(gameId, slots.slotBPlayerId);

  const arrows = useGameArrowInteractions({ gameId, game, boardRef, cardRegistry });
  const dialogs = useGameDialogs({
    gameId,
    game,
    localPlayer,
    localAccess,
    isSpectator,
    startPendingArrow: arrows.startPendingArrow,
    startPendingAttach: arrows.startPendingAttach,
  });
  const dnd = useGameDnd({ gameId, onDragStart: arrows.cancelPendingOnDragStart });

  // Explicit localPlayer null-check closes a window during reconnect where
  // `game` is present but `players[localPlayerId]` is not yet populated
  // (Event_GameStateChanged arrives after Event_GameJoined echo).
  const deckSelectOpen =
    game != null &&
    localPlayer != null &&
    !game.started &&
    !current.isSpectator &&
    !current.isJudge &&
    !localPlayer.properties.readyStart;

  // Hand zone visibility: as an active player you only see your own hand;
  // as a spectator you only see hands when the game was created with
  // omniscient spectators (`spectators_omniscient` on ServerInfo_Game). The
  // desktop server uses the same flag to gate sending real card data to
  // spectators (server_game.cpp:298-315), so when it's false the hand zone
  // would only show face-down placeholders anyway.
  const showHandZone =
    game != null &&
    slots.slotAPlayerId != null &&
    (
      (!isSpectator && slots.slotAPlayerId === game.localPlayerId) ||
      (isSpectator && (game.info.spectatorsOmniscient ?? false))
    );

  return {
    ...current,
    boardRef,
    cardRegistry,
    sensors,
    hoveredCard,
    setHoveredCard,
    isRotated,
    toggleRotated,
    localAccess,
    slotAAccess,
    slotBAccess,
    deckSelectOpen,
    showHandZone,
    slots,
    arrows,
    dialogs,
    dnd,
  };
}
