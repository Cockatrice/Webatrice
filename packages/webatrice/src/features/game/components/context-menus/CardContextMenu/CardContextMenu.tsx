import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import type { SelectedCard } from '../../../utils/selection';
import {
  COUNTER_TYPE_COUNT,
  COUNTER_TYPE_LABELS,
  counterColorForId,
} from '../../ui/CardSlot/counterColors';

import NestedMenuItem from './NestedMenuItem';
import { useCardContextMenu } from './useCardContextMenu';

import './CardContextMenu.css';

export interface CardContextMenuProps {
  isOpen: boolean;
  anchorPosition: { top: number; left: number } | null;
  gameId: number;
  localPlayerId: number | null;
  card: ServerInfo_Card | null;
  ownerPlayerId: number | null;
  sourceZone: string | null;
  selectedCards?: readonly SelectedCard[];
  onClose: () => void;
  onRequestSetPT: () => void;
  onRequestSetAnnotation: () => void;
  onRequestSetCounter: (counterId: number) => void;
  onRequestDrawArrow: () => void;
  onRequestAttach: () => void;
  onRequestPlay: (faceDown: boolean) => void;
  onRequestMoveToLibraryAt: () => void;
}

const COUNTER_TYPE_IDS: ReadonlyArray<number> = Array.from(
  { length: COUNTER_TYPE_COUNT },
  (_, i) => i,
);

function hasCounter(card: ServerInfo_Card, counterId: number): boolean {
  return card.counterList.some((c) => c.id === counterId && c.value > 0);
}

function CardContextMenu(props: CardContextMenuProps) {
  const { isOpen, anchorPosition, card, onClose } = props;
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
  } = useCardContextMenu(props);

  if (!ready || !card) {
    return null;
  }

  return (
    <Menu
      open={isOpen}
      onClose={onClose}
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

export default CardContextMenu;
