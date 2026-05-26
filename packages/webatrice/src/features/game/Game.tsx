import { useMemo } from 'react';
import { DndContext } from '@dnd-kit/core';

import { AuthGuard } from '@app/components';
import { Layout } from '@app/feature-wrappers/layout';
import { ConfirmDialog, PromptDialog } from '@app/dialogs';
import { Enriched } from '@cockatrice/datatrice';
import GameArrowOverlay from './components/arrows/GameArrowOverlay/GameArrowOverlay';
import CardContextMenu from './components/context-menus/CardContextMenu/CardContextMenu';
import HandContextMenu from './components/context-menus/HandContextMenu/HandContextMenu';
import PlayerContextMenu from './components/context-menus/PlayerContextMenu/PlayerContextMenu';
import ZoneContextMenu from './components/context-menus/ZoneContextMenu/ZoneContextMenu';
import PhaseBar from './components/right-sidebar/PhaseBar/PhaseBar';
import RightPanel from './components/right-sidebar/RightPanel/RightPanel';
import { CardDragOverlayHost } from './components/ui/CardDragOverlay/CardDragOverlay';
import HandZone from './components/ui/HandZone/HandZone';
import PlayerBoard from './components/ui/PlayerBoard/PlayerBoard';
import CreateTokenDialog from './dialogs/CreateTokenDialog/CreateTokenDialog';
import DeckSelectDialog from './dialogs/DeckSelectDialog/DeckSelectDialog';
import GameInfoDialog from './dialogs/GameInfoDialog/GameInfoDialog';
import RevealCardsDialog from './dialogs/RevealCardsDialog/RevealCardsDialog';
import RollDieDialog from './dialogs/RollDieDialog/RollDieDialog';
import SideboardDialog, { cardsFromZone } from './dialogs/SideboardDialog/SideboardDialog';
import ZoneViewDialog from './dialogs/ZoneViewDialog/ZoneViewDialog';
import { useGame } from './hooks/useGame';
import { CardRegistryContext } from './utils/CardRegistry/CardRegistryContext';
import { GameInteractionProvider } from './components/ui/GameInteractionContext';

import './Game.css';

function Game() {
  const g = useGame();
  const {
    gameId,
    game,
    localPlayer,
    boardRef,
    cardRegistry,
    sensors,
    hoveredCard,
    setHoveredCard,
    isRotated,
    toggleRotated,
    slotAAccess,
    slotBAccess,
    deckSelectOpen,
    showHandZone,
    slots,
    arrows,
    dialogs,
    dnd,
  } = g;

  const interactionHandlers = useMemo(
    () => ({
      onCardHover: setHoveredCard,
      onCardClick: arrows.handleCardClick,
      onCardContextMenu: dialogs.handleCardContextMenu,
      onCardDoubleClick: arrows.handleCardDoubleClick,
      onZoneClick: dialogs.handleZoneClick,
      onZoneContextMenu: dialogs.handleZoneContextMenu,
    }),
    [
      setHoveredCard,
      arrows.handleCardClick,
      arrows.handleCardDoubleClick,
      dialogs.handleCardContextMenu,
      dialogs.handleZoneClick,
      dialogs.handleZoneContextMenu,
    ],
  );

  return (
    <Layout>
      <AuthGuard />
      <CardRegistryContext.Provider value={cardRegistry}>
        <DndContext
          sensors={sensors}
          onDragStart={arrows.cancelPendingOnDragStart}
          onDragEnd={dnd.handleDragEnd}
        >
          <div className="game" data-testid="game-container">
            <PhaseBar gameId={gameId} />

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

              {game && slots.slotBPlayerId != null && slots.slotAPlayerId != null && (
                <GameInteractionProvider value={interactionHandlers}>
                  <div
                    className={
                      'game__board-inner' +
                      (isRotated ? ' game__board-inner--rotated' : '')
                    }
                  >
                    <PlayerBoard
                      gameId={gameId!}
                      playerId={slots.slotBPlayerId}
                      mirrored
                      canAct={slotBAccess.canAct}
                      canEditCounters={slotBAccess.canAct}
                      arrowSourceKey={arrows.arrowSourceKey}
                      players={slots.players}
                      onSelectPlayer={slots.setSlotBPlayerId}
                    />
                    <PlayerBoard
                      gameId={gameId!}
                      playerId={slots.slotAPlayerId}
                      canAct={slotAAccess.canAct}
                      canEditCounters={slotAAccess.canAct}
                      arrowSourceKey={arrows.arrowSourceKey}
                      onPlayerContextMenu={dialogs.handlePlayerContextMenu}
                      players={slots.players}
                      onSelectPlayer={slots.setSlotAPlayerId}
                    />
                    {showHandZone && (
                      <HandZone
                        gameId={gameId!}
                        playerId={slots.slotAPlayerId}
                        canAct={slotAAccess.canAct}
                        arrowSourceKey={arrows.arrowSourceKey}
                        onHandContextMenu={dialogs.handleHandContextMenu}
                      />
                    )}
                  </div>
                </GameInteractionProvider>
              )}

              <GameArrowOverlay gameId={gameId} boardRef={boardRef} dragPreview={arrows.dragPreview} />
            </div>

            <RightPanel
              gameId={gameId}
              hoveredCard={hoveredCard}
              onRequestRollDie={dialogs.openRollDie}
              onRequestConcede={dialogs.openConcede}
              onRequestUnconcede={dialogs.openUnconcede}
              onRequestGameInfo={dialogs.openGameInfo}
              onToggleRotate90={toggleRotated}
              isRotated={isRotated}
            />

            <DeckSelectDialog isOpen={deckSelectOpen} gameId={gameId} />

            {dialogs.zoneViews.map((v, idx) => (
              <ZoneViewDialog
                key={`${v.playerId}-${v.zoneName}`}
                isOpen
                gameId={gameId}
                playerId={v.playerId}
                zoneName={v.zoneName}
                handleClose={() => dialogs.handleCloseZoneView(v.playerId, v.zoneName)}
                initialPosition={{ x: 80 + idx * 36, y: 80 + idx * 36 }}
              />
            ))}

            <CardContextMenu
              isOpen={dialogs.cardMenu != null}
              anchorPosition={dialogs.cardMenu?.anchorPosition ?? null}
              gameId={gameId ?? 0}
              localPlayerId={game?.localPlayerId ?? null}
              card={dialogs.cardMenu?.card ?? null}
              ownerPlayerId={dialogs.cardMenu?.sourcePlayerId ?? null}
              sourceZone={dialogs.cardMenu?.sourceZone ?? null}
              onClose={dialogs.closeCardMenu}
              onRequestSetPT={dialogs.handleRequestSetPT}
              onRequestSetAnnotation={dialogs.handleRequestSetAnnotation}
              onRequestSetCounter={dialogs.handleRequestSetCardCounter}
              onRequestDrawArrow={dialogs.handleRequestDrawArrow}
              onRequestAttach={dialogs.handleRequestAttach}
              onRequestPlay={dialogs.handleRequestPlayFromCardMenu}
              onRequestMoveToLibraryAt={dialogs.handleRequestMoveToLibraryAt}
            />

            <ZoneContextMenu
              isOpen={dialogs.zoneMenu != null}
              anchorPosition={dialogs.zoneMenu?.anchorPosition ?? null}
              gameId={gameId ?? 0}
              playerId={dialogs.zoneMenu?.playerId ?? null}
              zoneName={dialogs.zoneMenu?.zoneName ?? null}
              onClose={dialogs.closeZoneMenu}
              onRequestDrawN={dialogs.handleRequestDrawN}
              onRequestDumpN={dialogs.handleRequestDumpN}
              onRequestRevealTopN={dialogs.handleRequestRevealTopN}
              onRequestRevealZone={dialogs.handleRequestRevealZone}
              onRequestUndoDraw={dialogs.handleRequestUndoDraw}
              onRequestDrawBottom={dialogs.handleRequestDrawBottom}
              onRequestMoveTopCardToZone={dialogs.handleRequestMoveTopCardToZone}
              onRequestPlayTop={dialogs.handleRequestPlayTop}
              onRequestMoveTopNToZone={dialogs.handleRequestMoveTopNToZone}
              onRequestShuffleTopN={dialogs.handleRequestShuffleTopN}
              onRequestShuffleBottomN={dialogs.handleRequestShuffleBottomN}
              onRequestViewZone={dialogs.handleRequestViewZone}
              onRequestMoveAllFromZoneToDeck={dialogs.handleRequestMoveAllFromZoneToDeck}
              onRequestMoveAllFromZoneTo={dialogs.handleRequestMoveAllFromZoneTo}
              onRequestRevealRandomFromZone={dialogs.handleRequestRevealRandomFromZone}
            />

            <PlayerContextMenu
              isOpen={dialogs.playerMenu != null}
              anchorPosition={dialogs.playerMenu}
              onClose={dialogs.closePlayerMenu}
              onRequestCreateToken={dialogs.openCreateToken}
              onRequestViewSideboard={dialogs.openSideboard}
            />

            <HandContextMenu
              isOpen={dialogs.handMenu != null}
              anchorPosition={dialogs.handMenu}
              gameId={gameId ?? 0}
              handSize={localPlayer?.zones[Enriched.ZoneName.HAND]?.cardCount ?? 0}
              onClose={dialogs.closeHandMenu}
              onRequestChooseMulligan={dialogs.handleRequestChooseMulligan}
              onRequestRevealHand={dialogs.handleRequestRevealHand}
              onRequestRevealRandom={dialogs.handleRequestRevealRandom}
              onRequestViewHand={dialogs.handleRequestViewHand}
              onRequestSortHandBy={dialogs.handleRequestSortHandBy}
              onRequestMoveHandToDeck={dialogs.handleRequestMoveHandToDeck}
              onRequestMoveHandToZone={dialogs.handleRequestMoveHandToZone}
            />

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

            <RollDieDialog
              isOpen={dialogs.rollDieOpen}
              lastSides={dialogs.lastDieSides}
              lastCount={dialogs.lastDieCount}
              onSubmit={dialogs.handleRollDieSubmit}
              onCancel={dialogs.closeRollDie}
            />

            <CreateTokenDialog
              isOpen={dialogs.createTokenOpen}
              onSubmit={dialogs.handleCreateTokenSubmit}
              onCancel={dialogs.closeCreateToken}
            />

            <SideboardDialog
              isOpen={dialogs.sideboardOpen}
              playerName={localPlayer?.properties.userInfo?.name ?? ''}
              deckCards={cardsFromZone(localPlayer?.zones[Enriched.ZoneName.DECK])}
              sideboardCards={cardsFromZone(localPlayer?.zones[Enriched.ZoneName.SIDEBOARD])}
              isLocked={localPlayer?.properties.sideboardLocked ?? false}
              onSubmit={dialogs.handleSideboardSubmit}
              onCancel={dialogs.closeSideboard}
              onToggleLock={dialogs.handleToggleSideboardLock}
            />

            {dialogs.revealState && (
              <RevealCardsDialog
                isOpen
                title={dialogs.revealState.title}
                zoneLabel={dialogs.revealState.zoneLabel}
                showCountInput={dialogs.revealState.showCountInput}
                defaultCount={dialogs.revealState.defaultCount}
                players={slots.revealPlayers}
                onSubmit={dialogs.revealState.onSubmit}
                onCancel={dialogs.closeReveal}
              />
            )}

            <ConfirmDialog
              isOpen={dialogs.concedeConfirm === 'concede'}
              title="Concede this game?"
              message="You'll stay seated as a spectator until you click Unconcede or Leave Game. Others will see you as conceded."
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

            <GameInfoDialog
              isOpen={dialogs.gameInfoOpen}
              gameId={gameId}
              onClose={dialogs.closeGameInfo}
            />
          </div>

          <CardDragOverlayHost />
        </DndContext>
      </CardRegistryContext.Provider>
    </Layout>
  );
}

export default Game;
