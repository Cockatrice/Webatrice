import { memo, useMemo } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { resolveSelectedCards } from '../../../utils/selection';
import {
  COUNTER_TYPE_COUNT,
  COUNTER_TYPE_LABELS,
  counterColorForId,
} from '../../ui/CardSlot/counterColors';

import NestedMenuItem from './NestedMenuItem';
import { useGameDialogsContext } from '../../ui/GameDialogsContext';
import { useGameId } from '../../ui/GameIdContext';
import { useCardVisualState } from '../../ui/CardVisualStateContext';
import { useLocalIdentity } from '../../../hooks/useLocalIdentity';
import { useCurrentGame } from '../../../hooks/useCurrentGame';
import { useCardContextMenu } from './useCardContextMenu';

import './CardContextMenu.css';

const COUNTER_TYPE_IDS: ReadonlyArray<number> = Array.from(
  { length: COUNTER_TYPE_COUNT },
  (_, i) => i,
);

function hasCounter(card: ServerInfo_Card, counterId: number): boolean {
  return card.counterList.some((c) => c.id === counterId && c.value > 0);
}

function CardContextMenu() {
  const dialogs = useGameDialogsContext();
  const gameId = useGameId();
  const { localPlayerId } = useLocalIdentity();
  const { selectedCardKeys } = useCardVisualState();
  const cardMenu = dialogs.cardMenu;
  const isOpen = cardMenu != null;
  const anchorPosition = cardMenu?.anchorPosition ?? null;
  const card = cardMenu?.card ?? null;

  // Resolve the multi-selection to live cards for bulk actions (was computed in
  // Game via the same helper and passed as a prop).
  const { game } = useCurrentGame(gameId);
  const selectedCards = useMemo(
    () => (game ? resolveSelectedCards(game, selectedCardKeys) : []),
    [game, selectedCardKeys],
  );

  const {
    ready,
    canActOnCard,
    canAttach,
    isAttached,
    canPlay,
    canPeek,
    moveTargets,
    handleFlip,
    handleTapToggle,
    handleFaceDownToggle,
    handleDoesntUntapToggle,
    handleSetPT,
    handleSetAnnotation,
    handleCardCounterDelta,
    handleSetCardCounter,
    handleDrawArrow,
    handleAttach,
    handleUnattach,
    handlePlay,
    handlePlayFaceDown,
    handlePeek,
    handleMove,
    handleMoveToLibraryAt,
  } = useCardContextMenu({
    gameId,
    localPlayerId: localPlayerId ?? null,
    card,
    ownerPlayerId: cardMenu?.sourcePlayerId ?? null,
    sourceZone: cardMenu?.sourceZone ?? null,
    selectedCards,
    onClose: dialogs.closeCardMenu,
    onRequestSetPT: dialogs.handleRequestSetPT,
    onRequestSetAnnotation: dialogs.handleRequestSetAnnotation,
    onRequestSetCounter: dialogs.handleRequestSetCardCounter,
    onRequestDrawArrow: dialogs.handleRequestDrawArrow,
    onRequestAttach: dialogs.handleRequestAttach,
    onRequestPlay: dialogs.handleRequestPlayFromCardMenu,
    onRequestMoveToLibraryAt: dialogs.handleRequestMoveToLibraryAt,
  });

  if (!ready || !card) {
    return null;
  }

  return (
    <Menu
      open={isOpen}
      onClose={dialogs.closeCardMenu}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition ?? undefined}
      data-testid="card-context-menu"
      className="card-context-menu"
    >
      {canPlay && (
        <>
          <MenuItem onClick={handlePlay}>Play</MenuItem>
          <MenuItem onClick={handlePlayFaceDown}>Play face down</MenuItem>
          <Divider />
        </>
      )}
      {canActOnCard && (
        <>
          <MenuItem onClick={handleFlip}>Flip</MenuItem>
          <MenuItem onClick={handleTapToggle}>{card.tapped ? 'Untap' : 'Tap'}</MenuItem>
          <MenuItem onClick={handleFaceDownToggle}>
            {card.faceDown ? 'Face Up' : 'Face Down'}
          </MenuItem>
          {canPeek && <MenuItem onClick={handlePeek}>Peek</MenuItem>}
          <MenuItem onClick={handleDoesntUntapToggle}>
            {card.doesntUntap ? 'Allow Untap' : 'Doesn\'t Untap'}
          </MenuItem>
          <MenuItem onClick={handleSetPT}>Set P/T…</MenuItem>
          <MenuItem onClick={handleSetAnnotation}>Set Annotation…</MenuItem>
          <Divider />
          <NestedMenuItem label="Counters" parentMenuOpen={isOpen}>
            {COUNTER_TYPE_IDS.map((id) => (
              <NestedMenuItem
                key={`counter-${id}`}
                parentMenuOpen={isOpen}
                label={
                  <>
                    <span
                      className="card-context-menu__counter-chip"
                      style={{ background: counterColorForId(id) }}
                      aria-hidden="true"
                    />
                    {COUNTER_TYPE_LABELS[id]}
                  </>
                }
              >
                <MenuItem onClick={() => handleCardCounterDelta(id, +1)}>
                  Add Counter
                </MenuItem>
                <MenuItem
                  onClick={() => handleCardCounterDelta(id, -1)}
                  disabled={!hasCounter(card, id)}
                >
                  Remove Counter
                </MenuItem>
                <MenuItem onClick={() => handleSetCardCounter(id)}>
                  Set Counter…
                </MenuItem>
              </NestedMenuItem>
            ))}
          </NestedMenuItem>
          <Divider />
        </>
      )}
      <MenuItem onClick={handleDrawArrow}>Draw arrow from here</MenuItem>
      {canActOnCard && canAttach && (
        <MenuItem onClick={handleAttach}>Attach to card…</MenuItem>
      )}
      {canActOnCard && canAttach && isAttached && (
        <MenuItem onClick={handleUnattach}>Unattach</MenuItem>
      )}
      {canActOnCard && (
        <>
          <Divider />
          {moveTargets.map((t) => (
            <MenuItem key={t.label} onClick={() => handleMove(t)}>
              {t.label}
            </MenuItem>
          ))}
          <MenuItem onClick={handleMoveToLibraryAt}>
            Move to library at position…
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

export default memo(CardContextMenu);
