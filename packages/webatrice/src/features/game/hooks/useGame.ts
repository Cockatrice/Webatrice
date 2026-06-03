import { RefObject, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { createCardRegistry, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { resolveSelectedCards, type SelectedCard } from '../utils/selection';
import { useCurrentGame, type CurrentGame } from './useCurrentGame';
import { useGameAccess, type GameAccess } from './useGameAccess';
import { useGameArrowInteractions, type GameArrowInteractions } from './useGameArrowInteractions';
import { useGameBoxSelection, type BoxSelectPreview } from './useGameBoxSelection';
import { useGameDialogs, type GameDialogs } from './useGameDialogs';
import { useGameDnd, type GameDnd } from './useGameDnd';
import { useJudgeTarget } from './useJudgeTarget';
import { useGameLifecycleNavigation } from './useGameLifecycleNavigation';
import { useGameBoardLayout, type GameBoardLayout } from './useGameBoardLayout';
import { useGameSelection, type GameSelection } from './useGameSelection';
import { useGameShortcuts } from './useGameShortcuts';

export interface Game extends CurrentGame {
  boardRef: RefObject<HTMLDivElement>;
  gameRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
  sensors: ReturnType<typeof useSensors>;
  hoveredCard: ServerInfo_Card | null;
  setHoveredCard: (card: ServerInfo_Card | null) => void;
  previewCard: ServerInfo_Card | null;
  selectedCardKeys: ReadonlySet<string>;
  selectedCards: readonly SelectedCard[];
  onCardFocus: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardBlur: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  collapseUnlessSelected: GameSelection['collapseUnlessSelected'];
  handleGameMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  boxSelectPreview: BoxSelectPreview | null;
  localAccess: GameAccess;
  layout: GameBoardLayout;
  arrows: GameArrowInteractions;
  dialogs: GameDialogs;
  dnd: GameDnd;
}

export function useGame(): Game {
  const params = useParams<{ gameId?: string }>();
  const parsed = params.gameId != null ? Number(params.gameId) : NaN;
  const routeGameId = Number.isFinite(parsed) ? parsed : undefined;
  const current = useCurrentGame(routeGameId);
  const { gameId, game, isSpectator } = current;

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
  const selection = useGameSelection();
  const previewCard = selection.focused?.card ?? hoveredCard;
  const selectedCards = useMemo(
    () => (game ? resolveSelectedCards(game, selection.selectedCardKeys) : []),
    [game, selection.selectedCardKeys],
  );

  const layout = useGameBoardLayout(game);
  const localAccess = useGameAccess(gameId, game?.localPlayerId);
  const judgeTarget = useJudgeTarget(gameId);

  const arrows = useGameArrowInteractions({
    gameId,
    game,
    containerRef: gameRef,
    cardRegistry,
    selectedCards,
    collapseUnlessSelected: selection.collapseUnlessSelected,
  });
  const box = useGameBoxSelection({
    selectedCardKeys: selection.selectedCardKeys,
    setSelectedCardKeys: selection.setSelectedCardKeys,
    clearSelection: selection.clearSelection,
    clearFocused: selection.clearFocused,
    pendingActive: arrows.pending,
  });
  const dialogs = useGameDialogs({
    gameId,
    localAccess,
    isSpectator,
    startPendingArrow: arrows.startPendingArrow,
    startPendingAttach: arrows.startPendingAttach,
    collapseUnlessSelected: selection.collapseUnlessSelected,
  });
  const dnd = useGameDnd({
    gameId,
    judgeTarget,
    cancelPendingArrow: arrows.cancelPendingOnDragStart,
    collapseUnlessSelected: selection.collapseUnlessSelected,
  });

  useGameShortcuts({ gameId, onRequestConcede: dialogs.openConcede });

  return {
    ...current,
    boardRef,
    gameRef,
    cardRegistry,
    sensors,
    hoveredCard,
    setHoveredCard,
    previewCard,
    selectedCardKeys: selection.selectedCardKeys,
    selectedCards,
    onCardFocus: selection.onCardFocus,
    onCardBlur: selection.onCardBlur,
    collapseUnlessSelected: selection.collapseUnlessSelected,
    handleGameMouseDown: box.handleGameMouseDown,
    boxSelectPreview: box.previewRect,
    localAccess,
    layout,
    arrows,
    dialogs,
    dnd,
  };
}
