import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { DndContext } from '@dnd-kit/core';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { ConfirmDialog, PromptDialog } from '@app/dialogs';
import GameLobby from './GameLobby';
import { useCurrentGame } from './hooks/useCurrentGame';
import GameArrowOverlay from './components/arrows/GameArrowOverlay/GameArrowOverlay';
import BoxSelectOverlay from './components/ui/BoxSelectOverlay/BoxSelectOverlay';
import CardContextMenu from './components/context-menus/CardContextMenu/CardContextMenu';
import HandContextMenu from './components/context-menus/HandContextMenu/HandContextMenu';
import PlayerContextMenu from './components/context-menus/PlayerContextMenu/PlayerContextMenu';
import ZoneContextMenu from './components/context-menus/ZoneContextMenu/ZoneContextMenu';
import PhaseTrack from './components/PhaseTrack/PhaseTrack';
import BattlefieldSidebar from './components/BattlefieldSidebar/BattlefieldSidebar';
import { CardDragOverlayHost } from './components/ui/CardDragOverlay/CardDragOverlay';
import GameBoardCell from './components/ui/GameBoardCell/GameBoardCell';
import { HoveredCardProvider } from './components/PlayerBox/hoveredCard';
import { BigCardPreviewProvider } from './components/PlayerBox/bigCardPreview';
import { CardScaleProvider } from './components/PlayerBox/cardScale';
import IncomingRevealDialog from './components/PlayerBox/IncomingRevealDialog';
import { ForeignDragProvider } from './components/PlayerBox/foreignDragContext';
import CreateTokenDialog from './dialogs/CreateTokenDialog/CreateTokenDialog';
import DeckSelectDialog from './dialogs/DeckSelectDialog/DeckSelectDialog';
import GameInfoDialog from './dialogs/GameInfoDialog/GameInfoDialog';
import RevealCardsDialog from './dialogs/RevealCardsDialog/RevealCardsDialog';
import RollDieDialog from './dialogs/RollDieDialog/RollDieDialog';
import SideboardDialog from './dialogs/SideboardDialog/SideboardDialog';
import ZoneViewDialog from './dialogs/ZoneViewDialog/ZoneViewDialog';
import { useGame } from './hooks/useGame';
import { CardRegistryContext } from './utils/CardRegistry/CardRegistryContext';
import { GameInteractionProvider } from './components/ui/GameInteractionContext';
import { CardVisualStateProvider } from './components/ui/CardVisualStateContext';
import { GameDialogActionsProvider } from './components/ui/GameDialogActionsContext';
import { GameIdProvider } from './components/ui/GameIdContext';
import { CardPreviewProvider } from './components/ui/CardPreviewContext';
import { GameDialogsProvider } from './components/ui/GameDialogsContext';

import './Game.css';

const CONCEDE_CONFIRM_MESSAGE =
  'You\'ll stay seated as a spectator until you click Unconcede or Leave Game. Others will see you as conceded.';

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

  if (game && !isStarted && routeGameId != null) {
    return <GameLobby gameId={routeGameId} />;
  }
  return <GameBoard />;
}

function GameBoard() {
  const g = useGame();
  const {
    gameId,
    game,
    boardRef,
    gameRef,
    cardRegistry,
    sensors,
    setHoveredCard,
    previewCard,
    selectedCardKeys,
    onCardFocus,
    onCardBlur,
    handleGameMouseDown,
    boxSelectPreview,
    layout,
    arrows,
    dialogs,
    dnd,
  } = g;

  const interactionHandlers = useMemo(
    () => ({
      onCardHover: setHoveredCard,
      onCardFocus,
      onCardBlur,
      onCardClick: arrows.handleCardClick,
      onCardContextMenu: dialogs.handleCardContextMenu,
      onCardDoubleClick: arrows.handleCardDoubleClick,
      onZoneClick: dialogs.handleZoneClick,
      onZoneContextMenu: dialogs.handleZoneContextMenu,
    }),
    [
      setHoveredCard,
      onCardFocus,
      onCardBlur,
      arrows.handleCardClick,
      arrows.handleCardDoubleClick,
      dialogs.handleCardContextMenu,
      dialogs.handleZoneClick,
      dialogs.handleZoneContextMenu,
    ],
  );

  // Maps each seated playerId to its canAct, reusing the layout's per-cell value
  // (the local seat in bottomHand carries the same computeCanAct result, so the
  // bottom hand bar resolves correctly too). Stable across arrow drags so
  // canActFor-only consumers don't re-render on every drag tick.
  const canActFor = useMemo(() => {
    const byPlayerId = new Map(layout.cells.map((cell) => [cell.playerId, cell.canAct]));
    return (playerId: number) => byPlayerId.get(playerId) ?? false;
  }, [layout.cells]);

  // Dialog/confirm-opening actions surfaced by the TurnControls sidebar. Provided
  // via context so RightPanel (which doesn't use them) needn't forward them.
  const dialogActions = useMemo(
    () => ({
      onRequestRollDie: dialogs.openRollDie,
      onRequestConcede: dialogs.openConcede,
      onRequestUnconcede: dialogs.openUnconcede,
      onRequestGameInfo: dialogs.openGameInfo,
      onRequestViewSideboard: dialogs.openViewSideboard,
    }),
    [
      dialogs.openRollDie,
      dialogs.openConcede,
      dialogs.openUnconcede,
      dialogs.openGameInfo,
      dialogs.openViewSideboard,
    ],
  );

  return (
    <Layout>
      <AuthGuard />
      <CardRegistryContext.Provider value={cardRegistry}>
        <GameIdProvider value={gameId}>
          <HoveredCardProvider>
          <BigCardPreviewProvider>
          <ForeignDragProvider>
          <CardScaleProvider containerRef={boardRef} rows={layout.rows}>
          <DndContext
            sensors={sensors}
            collisionDetection={dnd.collisionDetection}
            onDragStart={dnd.handleDragStart}
            onDragEnd={dnd.handleDragEnd}
          >
            <GameInteractionProvider value={interactionHandlers}>
              <CardVisualStateProvider
                arrowSourceKey={arrows.arrowSourceKey}
                arrowTargetKey={arrows.arrowTargetKey}
                selectedCardKeys={selectedCardKeys}
                canActFor={canActFor}
              >
                <GameDialogActionsProvider value={dialogActions}>
                  <CardPreviewProvider value={previewCard ?? null}>
                    <GameDialogsProvider value={dialogs}>
                      <div
                        className="game"
                        data-testid="game-container"
                        ref={gameRef}
                        onMouseDown={handleGameMouseDown}
                      >
                        <PhaseTrack />

                        {/* Grid-column-1 placeholder. PhaseTrack is
                             absolutely positioned so it doesn't consume
                             a grid cell on its own — this empty div
                             reserves the 8 px column so the play area
                             lands in column 2 and its width stays
                             constant whether the phase track is
                             collapsed or expanded. */}
                        <div aria-hidden />

                        <div
                          className="game__board"
                          ref={boardRef}
                          onMouseDown={arrows.handleBoardMouseDown}
                        >
                          {!game && (
                            <div className="game__empty" data-testid="game-empty">
                  No active game. Join a game from a room to see the board.
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
                                  onPlayerContextMenu={dialogs.handlePlayerContextMenu}
                                  onPlayerClick={arrows.handlePlayerClick}
                                  onHandContextMenu={dialogs.handleHandContextMenu}
                                />
                              ))}
                            </div>
                          )}
                          {/* Bottom-bar HandZone removed: each PlayerBox now
                              renders its own hand inline. Kept the space so
                              downstream layout hooks that watched the empty
                              bottom bar don't recompute their heights. */}
                        </div>

                        <BattlefieldSidebar />

                        <GameArrowOverlay containerRef={gameRef} dragPreview={arrows.dragPreview} />

                        <BoxSelectOverlay preview={boxSelectPreview} />

                        <DeckSelectDialog />

                        {dialogs.zoneViews.map((v, idx) => (
                          <ZoneViewDialog
                            key={`${v.playerId}-${v.zoneName}`}
                            isOpen
                            playerId={v.playerId}
                            zoneName={v.zoneName}
                            handleClose={(shuffleOnClose) => dialogs.handleCloseZoneView(v.playerId, v.zoneName, shuffleOnClose)}
                            initialPosition={{ x: 80 + idx * 36, y: 80 + idx * 36 }}
                          />
                        ))}

                        <CardContextMenu />

                        <ZoneContextMenu />

                        <PlayerContextMenu />

                        <HandContextMenu />

                        {dialogs.prompt && (
                          <PromptDialog
                            isOpen
                            title={dialogs.prompt.title}
                            label={dialogs.prompt.label}
                            initialValue={dialogs.prompt.initialValue}
                            helperText={dialogs.prompt.helperText}
                            validate={dialogs.prompt.validate}
                            onSubmit={dialogs.prompt.onSubmit}
                            onCancel={dialogs.closePrompt}
                          />
                        )}

                        <RollDieDialog />

                        <CreateTokenDialog />

                        <SideboardDialog />

                        <RevealCardsDialog />

                        {/* Receiver-side popup: opens whenever an
                            Event_RevealCards arrives with a populated
                            card list (someone revealed a zone to us,
                            or "to all players" including us). Reads /
                            dismisses via the incomingReveal slice. */}
                        <IncomingRevealDialog />

                        <ConfirmDialog
                          isOpen={dialogs.concedeConfirm === 'concede'}
                          title="Concede this game?"
                          message={CONCEDE_CONFIRM_MESSAGE}
                          confirmLabel="Concede"
                          destructive
                          onConfirm={dialogs.confirmConcede}
                          onCancel={dialogs.closeConcedeConfirm}
                        />

                        <ConfirmDialog
                          isOpen={dialogs.concedeConfirm === 'unconcede'}
                          title="Rejoin the game?"
                          message="This undoes your concede and puts you back into the active player rotation."
                          confirmLabel="Unconcede"
                          onConfirm={dialogs.confirmUnconcede}
                          onCancel={dialogs.closeConcedeConfirm}
                        />

                        <GameInfoDialog />
                      </div>
                    </GameDialogsProvider>
                  </CardPreviewProvider>
                </GameDialogActionsProvider>
              </CardVisualStateProvider>
            </GameInteractionProvider>

            <CardDragOverlayHost />
          </DndContext>
          </CardScaleProvider>
          </ForeignDragProvider>
          </BigCardPreviewProvider>
          </HoveredCardProvider>
        </GameIdProvider>
      </CardRegistryContext.Provider>
    </Layout>
  );
}

export default Game;
