import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';

import { AuthGuard, isContextMenuKey } from '@app/components';
import { usePreference } from '@app/hooks';
import { Layout } from '@app/feature-wrappers/layout';
import { ConfirmDialog, PromptDialog } from '@app/dialogs';
import GameLobby from './GameLobby';
import GameErrorBoundary from './GameErrorBoundary';
import { useCurrentGame } from './hooks/useCurrentGame';
import GameArrowOverlay from './components/arrows/GameArrowOverlay/GameArrowOverlay';
import TurnBar from './components/TurnBar/TurnBar';
import GameDock from './components/GameDock/GameDock';
import BoardTray from './components/BoardTray/BoardTray';
import { BoardTrayHostProvider } from './components/BoardTray/BoardTrayContext';
import SidebarResizer from './components/SidebarResizer/SidebarResizer';
import { useSidebarWidth } from './hooks/useSidebarWidth';
import { useDockState } from './hooks/useDockState';
import GameBoardCell from './components/ui/GameBoardCell/GameBoardCell';
import { BigCardPreview } from './components/ui/BigCardPreview/BigCardPreview';
import { BoardMotionConfig } from './components/ui/BoardMotionConfig/BoardMotionConfig';
import { CardScaleProvider } from './components/ui/CardScaleContext';
import IncomingRevealDialog from './dialogs/IncomingRevealDialog/IncomingRevealDialog';
import TallyOverlay from './components/TallyOverlay/TallyOverlay';
import CreateTokenDialog from './dialogs/CreateTokenDialog/CreateTokenDialog';
import MoveTopUntilDialog from './dialogs/MoveTopUntilDialog/MoveTopUntilDialog';
import DeckSelectDialog from './dialogs/DeckSelectDialog/DeckSelectDialog';
import GameInfoDialog from './dialogs/GameInfoDialog/GameInfoDialog';
import RollDieDialog from './dialogs/RollDieDialog/RollDieDialog';
import ZoneViewDialog from './dialogs/ZoneViewDialog/ZoneViewDialog';
import { useGame } from './hooks/useGame';
import { CardRegistryContext } from './utils/CardRegistry/CardRegistryContext';
import { keepFocusOnBoardPress } from './utils/keepChatFocus';
import { CardVisualStateProvider } from './components/ui/CardVisualStateContext';
import { PendingTargetProvider } from './components/ui/PendingTargetContext';
import { KeyboardMoveProvider } from './components/ui/KeyboardMoveContext';
import PendingTargetAnnouncer from './components/ui/PendingTargetAnnouncer/PendingTargetAnnouncer';
import { GameDialogActionsProvider } from './components/ui/GameDialogActionsContext';
import { GameIdProvider } from './components/ui/GameIdContext';
import { CardPreviewProvider } from './components/ui/CardPreviewContext';
import { SeatShortcutsProvider } from './components/ui/SeatShortcutsContext';
import { GameSelectionProvider } from './components/ui/GameSelectionContext';
import { ActiveSeatDragProvider } from './components/ui/SeatDragContext';
import { GameDialogsProvider } from './components/ui/GameDialogsContext';
import { useGameReadOnly } from './components/ui/GameReadOnlyContext';

import './Game.css';

/**
 * Top-level game route. Splits the render into two paths:
 *   • Pre-start (game exists but `started === false`): the full-page
 *     GameLobby handles deck selection, ready toggling, and host
 *     force-start (via kick).
 *   • Started: the existing battlefield renders below in GameBoard.
 * The gate lives outside useGame() so the heavy game infra (DND
 * sensors, card registry, board layout memoization, arrow overlay)
 * doesn't initialize while we're still lobbying — cheap since
 * useCurrentGame is just a couple of Redux selectors.
 */
function Game() {
  const params = useParams<{ gameId?: string }>();
  const parsed = params.gameId != null ? Number(params.gameId) : NaN;
  const routeGameId = Number.isFinite(parsed) ? parsed : undefined;
  const { game, isStarted } = useCurrentGame(routeGameId);

  return (
    <GameErrorBoundary gameId={routeGameId}>
      {game && !isStarted && routeGameId != null ? <GameLobby gameId={routeGameId} /> : <GameBoard />}
    </GameErrorBoundary>
  );
}

function swallowBoardInput(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function guardReplayClick(event: React.MouseEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest('[data-replay-zone-view]')) {
    return;
  }
  swallowBoardInput(event);
}

function guardReplayKey(event: React.KeyboardEvent) {
  if (isContextMenuKey(event)) {
    swallowBoardInput(event);
  }
}

const READ_ONLY_BOARD_GUARD = {
  onPointerDownCapture: swallowBoardInput,
  onMouseDownCapture: swallowBoardInput,
  onClickCapture: guardReplayClick,
  onDoubleClickCapture: swallowBoardInput,
  onContextMenuCapture: swallowBoardInput,
  onDragStartCapture: swallowBoardInput,
  onKeyDownCapture: guardReplayKey,
};

const noop = () => {};

export interface GameBoardProps {
  gameId?: number;
  footer?: ReactNode;
  onLeave?: () => void;
}

export function GameBoard({ gameId: boardGameId, footer, onLeave }: GameBoardProps = {}) {
  const { t } = useTranslation();
  const readOnly = useGameReadOnly();
  const g = useGame({ gameId: boardGameId, readOnly });
  const {
    gameId,
    game,
    boardRef,
    gameRef,
    cardRegistry,
    sensors,
    previewStore,
    seatShortcuts,
    selectedCardKeys,
    setSelectedCardKeys,
    layout,
    rotateView,
    arrows,
    dialogs,
    dnd,
  } = g;

  const { width: sidebarWidth, setWidth: setSidebarWidth } = useSidebarWidth();
  const dock = useDockState();
  const keepGameChatFocus = usePreference('keepGameChatFocus');
  const [trayHost, setTrayHost] = useState<HTMLDivElement | null>(null);
  const handleBoardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (keepGameChatFocus) {
      keepFocusOnBoardPress(e);
    }
    arrows.handleBoardMouseDown(e);
  }, [keepGameChatFocus, arrows]);

  // Maps each seated playerId to its canAct, reusing the layout's per-cell value
  // (the local seat in bottomHand carries the same computeCanAct result, so the
  // bottom hand bar resolves correctly too). Stable across arrow drags so
  // canActFor-only consumers don't re-render on every drag tick.
  const canActFor = useMemo(() => {
    const byPlayerId = new Map(layout.cells.map((cell) => [cell.playerId, cell.canAct]));
    return (playerId: number) => byPlayerId.get(playerId) ?? false;
  }, [layout.cells]);

  // Dialog/confirm-opening actions and the view rotation, surfaced by the sidebar. Provided
  // via context so RightPanel (which doesn't use them) needn't forward them.
  const dialogActions = useMemo(
    () => (readOnly
      ? {
        onRequestRollDie: noop,
        onRequestConcede: noop,
        onRequestUnconcede: noop,
        onRequestGameInfo: noop,
        onRequestViewSideboard: noop,
        onRequestLeave: onLeave ?? noop,
        onRotateView: rotateView,
      }
      : {
        onRequestRollDie: dialogs.openRollDie,
        onRequestConcede: dialogs.openConcede,
        onRequestUnconcede: dialogs.openUnconcede,
        onRequestGameInfo: dialogs.openGameInfo,
        onRequestViewSideboard: dialogs.openViewSideboard,
        onRequestLeave: onLeave ?? dialogs.openLeaveConfirm,
        onRotateView: rotateView,
      }),
    [
      readOnly,
      onLeave,
      dialogs.openRollDie,
      dialogs.openConcede,
      dialogs.openUnconcede,
      dialogs.openGameInfo,
      dialogs.openViewSideboard,
      dialogs.openLeaveConfirm,
      rotateView,
    ],
  );

  return (
    <Layout>
      {!readOnly && <AuthGuard />}
      <BoardMotionConfig>
        <CardRegistryContext.Provider value={cardRegistry}>
          <GameIdProvider value={gameId}>
            <CardPreviewProvider store={previewStore}>
              <SeatShortcutsProvider registry={seatShortcuts}>
                <GameSelectionProvider selectedCardKeys={selectedCardKeys} setSelectedCardKeys={setSelectedCardKeys}>
                  <CardScaleProvider
                    containerRef={boardRef}
                    rows={layout.rows}
                    inlineHand={layout.handMode === 'inline'}
                  >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={dnd.collisionDetection}
                      onDragStart={dnd.handleDragStart}
                      onDragEnd={dnd.handleDragEnd}
                      onDragCancel={dnd.handleDragCancel}
                    >
                      <ActiveSeatDragProvider value={dnd.activeSeatDrag}>
                        <PendingTargetProvider value={arrows.pendingTarget}>
                          <PendingTargetAnnouncer />
                          <CardVisualStateProvider
                            arrowSourceKey={arrows.arrowSourceKey}
                            arrowTargetKey={arrows.arrowTargetKey}
                            selectedCardKeys={selectedCardKeys}
                            canActFor={canActFor}
                          >
                            <GameDialogActionsProvider value={dialogActions}>
                              <GameDialogsProvider value={dialogs}>
                                <KeyboardMoveProvider moveSeatCards={dnd.moveSeatCards}>
                                  <BoardTrayHostProvider host={trayHost}>
                                    <div
                                      className={footer ? 'game game--with-footer' : 'game'}
                                      data-testid="game-container"
                                      data-readonly={readOnly || undefined}
                                      data-dock-collapsed={dock.collapsed || undefined}
                                      ref={gameRef}
                                      style={{
                                        '--dock-width': dock.collapsed ? '44px' : `${sidebarWidth}px`,
                                        '--dock-resizer-width': dock.collapsed ? '0px' : '8px',
                                      } as React.CSSProperties}
                                    >
                                      <TurnBar />

                                      <div
                                        className="game__board"
                                        data-game-board
                                        ref={boardRef}
                                        onMouseDown={handleBoardMouseDown}
                                        {...(readOnly ? READ_ONLY_BOARD_GUARD : undefined)}
                                      >
                                        {!game && (
                                          <div className="game__empty" data-testid="game-empty">
                                            {t('Game.empty')}
                                          </div>
                                        )}

                                        {game && layout.cells.length > 0 && (
                                          <div
                                            className="game__board-grid"
                                            style={{
                                              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
                                              gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
                                            }}
                                          >
                                            {layout.cells.map((cell) => (
                                              <GameBoardCell
                                                key={cell.playerId}
                                                cell={cell}
                                                totalPlayers={layout.cells.length}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        <TallyOverlay />
                                      </div>

                                      {layout.bottomHand && <BoardTray hostRef={setTrayHost} onMouseDown={handleBoardMouseDown} />}

                                      <div className="game__resizer">
                                        {!dock.collapsed && <SidebarResizer width={sidebarWidth} onResize={setSidebarWidth} />}
                                      </div>

                                      <div className="game__dock" data-chat-dock-avoid>
                                        <GameDock
                                          collapsed={dock.collapsed}
                                          tab={dock.tab}
                                          onCollapse={dock.setCollapsed}
                                          onSelectTab={dock.setTab}
                                        />
                                      </div>

                                      <GameArrowOverlay containerRef={gameRef} layoutVersion={layout} dragPreview={arrows.dragPreview} />

                                      {!readOnly && <DeckSelectDialog />}

                                      {dialogs.zoneViews.map((v) => (
                                        <ZoneViewDialog
                                          key={`${v.playerId}-${v.zoneName}`}
                                          view={v}
                                          handleClose={(shuffleOnClose) =>
                                            dialogs.handleCloseZoneView(v.playerId, v.zoneName, shuffleOnClose)}
                                        />
                                      ))}

                                      {dialogs.prompt && (
                                        <PromptDialog
                                          isOpen
                                          {...dialogs.prompt}
                                          onCancel={dialogs.closePrompt}
                                        />
                                      )}

                                      <RollDieDialog />

                                      <CreateTokenDialog />

                                      <MoveTopUntilDialog />

                                      {/* Receiver-side popup: opens whenever an
                              Event_RevealCards arrives with a populated
                              card list (someone revealed a zone to us,
                              or "to all players" including us). Reads /
                              dismisses via the incomingReveal slice. */}
                                      <IncomingRevealDialog />

                                      <ConfirmDialog
                                        isOpen={dialogs.concedeConfirm === 'concede'}
                                        title={t('GameDock.concede')}
                                        message={t('Game.confirm.concede.message')}
                                        confirmLabel={t('GameLink.yes')}
                                        cancelLabel={t('GameLink.no')}
                                        destructive
                                        onConfirm={dialogs.confirmConcede}
                                        onCancel={dialogs.closeConcedeConfirm}
                                      />

                                      <ConfirmDialog
                                        isOpen={dialogs.concedeConfirm === 'unconcede'}
                                        title={t('Game.confirm.unconcede.title')}
                                        message={t('Game.confirm.unconcede.message')}
                                        confirmLabel={t('GameLink.yes')}
                                        cancelLabel={t('GameLink.no')}
                                        onConfirm={dialogs.confirmUnconcede}
                                        onCancel={dialogs.closeConcedeConfirm}
                                      />

                                      <ConfirmDialog
                                        isOpen={dialogs.leaveConfirm}
                                        title={t('ShortcutsTab.action.game.leaveGame')}
                                        message={t('Game.confirm.leave.message')}
                                        confirmLabel={t('GameLink.yes')}
                                        cancelLabel={t('GameLink.no')}
                                        destructive
                                        onConfirm={dialogs.confirmLeave}
                                        onCancel={dialogs.closeLeaveConfirm}
                                      />

                                      <GameInfoDialog />

                                      {footer && <div className="game__footer">{footer}</div>}
                                    </div>
                                  </BoardTrayHostProvider>
                                </KeyboardMoveProvider>
                              </GameDialogsProvider>
                            </GameDialogActionsProvider>
                          </CardVisualStateProvider>
                        </PendingTargetProvider>
                      </ActiveSeatDragProvider>

                    </DndContext>
                  </CardScaleProvider>
                  <BigCardPreview />
                </GameSelectionProvider>
              </SeatShortcutsProvider>
            </CardPreviewProvider>
          </GameIdProvider>
        </CardRegistryContext.Provider>
      </BoardMotionConfig>
    </Layout>
  );
}

export default Game;
