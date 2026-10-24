import { RefObject, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSensor, useSensors } from '@dnd-kit/core';

import { usePreference } from '@app/hooks';
import { createCardPreviewStore, type CardPreviewStore } from '../components/ui/CardPreviewContext';
import { createSeatShortcutRegistry, type SeatShortcutRegistry } from '../components/ui/SeatShortcutsContext';
import { useMoveCard } from '../components/ui/GameBoardCell/useMoveCard';
import { GamePointerSensor } from './gamePointerSensor';
import { createCardRegistry, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { useCurrentGame, type CurrentGame } from './useCurrentGame';
import { useGameAccess, type GameAccess } from './useGameAccess';
import { useGameArrowInteractions, type GameArrowInteractions } from './useGameArrowInteractions';
import { useGameDialogs, type GameDialogs } from './useGameDialogs';
import { useGameDnd, type GameDnd } from './useGameDnd';
import { useJudgeTarget } from './useJudgeTarget';
import { useGameLifecycleNavigation } from './useGameLifecycleNavigation';
import { useGameBoardLayout, type GameBoardLayout, type RotationStep } from './useGameBoardLayout';
import { useGameSelection, type GameSelection } from './useGameSelection';
import { useGameShortcuts } from './useGameShortcuts';
import { useGameRotation } from './useGameRotation';

export interface Game extends CurrentGame {
  boardRef: RefObject<HTMLDivElement>;
  gameRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
  sensors: ReturnType<typeof useSensors>;
  previewStore: CardPreviewStore;
  seatShortcuts: SeatShortcutRegistry;
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: GameSelection['setSelectedCardKeys'];
  localAccess: GameAccess;
  layout: GameBoardLayout;
  rotateView: (step: RotationStep) => void;
  arrows: GameArrowInteractions;
  dialogs: GameDialogs;
  dnd: GameDnd;
}

export interface UseGameOptions {
  gameId?: number;
  readOnly?: boolean;
}

const NO_SENSORS: ReturnType<typeof useSensors> = [];

export function useGame({ gameId: boardGameId, readOnly = false }: UseGameOptions = {}): Game {
  const params = useParams<{ gameId?: string }>();
  const parsed = params.gameId != null ? Number(params.gameId) : NaN;
  const routeGameId = Number.isFinite(parsed) ? parsed : undefined;
  const current = useCurrentGame(boardGameId ?? routeGameId);
  const { gameId, game, isSpectator } = current;

  useGameLifecycleNavigation(readOnly ? undefined : gameId);

  const boardRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HTMLDivElement>(null);
  const cardRegistry = useMemo(() => createCardRegistry(), []);
  const pointerSensors = useMemo(() => new Set<GamePointerSensor>(), []);
  useEffect(() => () => {
    for (const sensor of pointerSensors) {
      sensor.dispose();
    }
  }, [pointerSensors, gameId, readOnly]);
  // See .github/instructions/webatrice-game.instructions.md#pointer--click-vs-drag.
  // Pointer only: seat drags hand dnd-kit just their pointerdown, so a
  // keyboard sensor never activated. The keyboard moves cards through the
  // card menu's "Move to" and the zone shortcuts instead.
  const sensors = useSensors(useSensor(GamePointerSensor, { activationDistance: 0, instances: pointerSensors }));
  const previewStore = useMemo(() => createCardPreviewStore(), []);
  const seatShortcuts = useMemo(() => createSeatShortcutRegistry(), []);
  const selection = useGameSelection();

  const { rotationSteps, rotateView } = useGameRotation(gameId);
  const layout = useGameBoardLayout(game, rotationSteps, usePreference('minPlayersForMultiColumnLayout'));
  const localAccess = useGameAccess(gameId, game?.localPlayerId);
  const judgeTarget = useJudgeTarget(gameId);

  const arrows = useGameArrowInteractions({
    gameId,
    containerRef: gameRef,
    cardRegistry,
  });
  const dialogs = useGameDialogs({ gameId, isSpectator });
  const moveCard = useMoveCard(gameId);
  const dnd = useGameDnd({
    gameId,
    judgeTarget,
    isJudge: localAccess.isJudge,
    cancelPendingArrow: arrows.cancelPendingOnDragStart,
    clearSelection: selection.clearSelection,
    moveCard,
  });

  useGameShortcuts({
    gameId,
    seatShortcuts,
    onRotateView: rotateView,
    onRequestConcede: dialogs.openConcede,
    onRequestDrawMultiple: dialogs.handleRequestDrawN,
    onRequestUndoDraw: dialogs.handleRequestUndoDraw,
    onRequestRollDie: dialogs.openRollDie,
    onRequestLeave: dialogs.openLeaveConfirm,
    onRequestViewSideboard: dialogs.openViewSideboard,
    onRequestSortHandByType: () => dialogs.handleRequestSortHandBy('maintype'),
    onRequestViewLibrary: dialogs.openViewLibrary,
    onRequestViewGraveyard: dialogs.openViewGraveyard,
    onRequestPlayTop: () => dialogs.handleRequestPlayTop(false),
    onRequestMoveTopToGrave: () => dialogs.handleRequestMoveTopCardToZone('grave'),
    onRequestMoveTopNToGrave: () => dialogs.handleRequestMoveTopNToZone('grave'),
    // Esc close-recent-view: pops the topmost zone-view dialog if any
    // exist. Returns whether it actually consumed the keystroke so the
    // shortcut handler can decide to preventDefault or fall through.
    onCloseRecentZoneView: () => {
      const top = dialogs.zoneViews[dialogs.zoneViews.length - 1];
      if (!top) {
        return false;
      }
      dialogs.handleCloseZoneView(top.playerId, top.zoneName);
      return true;
    },
  });

  return {
    ...current,
    boardRef,
    gameRef,
    cardRegistry,
    sensors: readOnly ? NO_SENSORS : sensors,
    previewStore,
    seatShortcuts,
    selectedCardKeys: selection.selectedCardKeys,
    setSelectedCardKeys: selection.setSelectedCardKeys,
    localAccess,
    layout,
    rotateView,
    arrows,
    dialogs,
    dnd,
  };
}
