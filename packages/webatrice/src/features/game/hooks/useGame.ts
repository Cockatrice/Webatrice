import { RefObject, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { createCardRegistry, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';
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
  cardRegistry: CardRegistry;
  sensors: ReturnType<typeof useSensors>;
  hoveredCard: ServerInfo_Card | null;
  setHoveredCard: (card: ServerInfo_Card | null) => void;
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
  // See .github/instructions/webatrice-game.instructions.md#pointer--click-vs-drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 0 } }),
    useSensor(KeyboardSensor),
  );
  const [hoveredCard, setHoveredCard] = useState<ServerInfo_Card | null>(null);
  // View-only 90° rotation. See .github/instructions/webatrice-game.instructions.md#board-rotation.
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

  // Spectator hand visibility gated on spectators_omniscient.
  // See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
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
