import { useMemo } from 'react';
import { DndContext } from '@dnd-kit/core';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { ConfirmDialog, PromptDialog } from '@app/dialogs';
import GameArrowOverlay from './components/arrows/GameArrowOverlay/GameArrowOverlay';
import BoxSelectOverlay from './components/ui/BoxSelectOverlay/BoxSelectOverlay';
import CardContextMenu from './components/context-menus/CardContextMenu/CardContextMenu';
import HandContextMenu from './components/context-menus/HandContextMenu/HandContextMenu';
import PlayerContextMenu from './components/context-menus/PlayerContextMenu/PlayerContextMenu';
import ZoneContextMenu from './components/context-menus/ZoneContextMenu/ZoneContextMenu';
import PhaseBar from './components/right-sidebar/PhaseBar/PhaseBar';
import RightPanel from './components/right-sidebar/RightPanel/RightPanel';
import { CardDragOverlayHost } from './components/ui/CardDragOverlay/CardDragOverlay';
import HandZone from './components/ui/HandZone/HandZone';
import GameBoardCell from './components/ui/GameBoardCell/GameBoardCell';
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

function Game() {
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
    }),
    [dialogs.openRollDie, dialogs.openConcede, dialogs.openUnconcede, dialogs.openGameInfo],
  );

  return (
    <Layout>
      <AuthGuard />
      <CardRegistryContext.Provider value={cardRegistry}>
        <GameIdProvider value={gameId}>
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
                        <PhaseBar />

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
                                  onPlayerContextMenu={dialogs.handlePlayerContextMenu}
                                  onPlayerClick={arrows.handlePlayerClick}
                                  onHandContextMenu={dialogs.handleHandContextMenu}
                                />
                              ))}
                            </div>
                          )}
                          {game && layout.bottomHand && (
                            <HandZone
                              playerId={layout.bottomHand.playerId}
                              onHandContextMenu={dialogs.handleHandContextMenu}
                            />
                          )}
                        </div>

                        <RightPanel />

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
        </GameIdProvider>
      </CardRegistryContext.Provider>
    </Layout>
  );
}

export default Game;
