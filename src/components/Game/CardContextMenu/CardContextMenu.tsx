import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';

import { Data } from '@app/types';

import {
  COUNTER_TYPE_COUNT,
  COUNTER_TYPE_LABELS,
  counterColorForId,
} from '../CardSlot/counterColors';

import { useCardContextMenu } from './useCardContextMenu';

import './CardContextMenu.css';

export interface CardContextMenuProps {
  isOpen: boolean;
  anchorPosition: { top: number; left: number } | null;
  gameId: number;
  localPlayerId: number | null;
  card: Data.ServerInfo_Card | null;
  ownerPlayerId: number | null;
  sourceZone: string | null;
  onClose: () => void;
  onRequestSetPT: () => void;
  onRequestSetAnnotation: () => void;
  onRequestSetCounter: (counterId: number) => void;
  onRequestDrawArrow: () => void;
  onRequestAttach: () => void;
  onRequestMoveToLibraryAt: () => void;
}

const COUNTER_TYPE_IDS: ReadonlyArray<number> = Array.from(
  { length: COUNTER_TYPE_COUNT },
  (_, i) => i,
);

function hasCounter(card: Data.ServerInfo_Card, counterId: number): boolean {
  return card.counterList.some((c) => c.id === counterId && c.value > 0);
}

function CardContextMenu(props: CardContextMenuProps) {
  const { isOpen, anchorPosition, card, onClose } = props;
  const {
    ready,
    isOwnedByLocal,
    canAttach,
    isAttached,
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
      {isOwnedByLocal && (
        <>
          <MenuItem onClick={handleFlip}>Flip</MenuItem>
          <MenuItem onClick={handleTapToggle}>{card.tapped ? 'Untap' : 'Tap'}</MenuItem>
          <MenuItem onClick={handleFaceDownToggle}>
            {card.faceDown ? 'Face Up' : 'Face Down'}
          </MenuItem>
          <MenuItem onClick={handleDoesntUntapToggle}>
            {card.doesntUntap ? 'Allow Untap' : 'Doesn\'t Untap'}
          </MenuItem>
          <MenuItem onClick={handleSetPT}>Set P/T…</MenuItem>
          <MenuItem onClick={handleSetAnnotation}>Set Annotation…</MenuItem>
          <Divider />
          {COUNTER_TYPE_IDS.map((id) => (
            <MenuItem
              key={`add-counter-${id}`}
              onClick={() => handleCardCounterDelta(id, +1)}
            >
              <span
                className="card-context-menu__counter-chip"
                style={{ background: counterColorForId(id) }}
                aria-hidden="true"
              />
              Add {COUNTER_TYPE_LABELS[id]} counter
            </MenuItem>
          ))}
          {COUNTER_TYPE_IDS.map((id) => (
            <MenuItem
              key={`remove-counter-${id}`}
              onClick={() => handleCardCounterDelta(id, -1)}
              disabled={!hasCounter(card, id)}
            >
              <span
                className="card-context-menu__counter-chip"
                style={{ background: counterColorForId(id) }}
                aria-hidden="true"
              />
              Remove {COUNTER_TYPE_LABELS[id]} counter
            </MenuItem>
          ))}
          {COUNTER_TYPE_IDS.map((id) => (
            <MenuItem
              key={`set-counter-${id}`}
              onClick={() => handleSetCardCounter(id)}
            >
              <span
                className="card-context-menu__counter-chip"
                style={{ background: counterColorForId(id) }}
                aria-hidden="true"
              />
              Set {COUNTER_TYPE_LABELS[id]} counter…
            </MenuItem>
          ))}
          <Divider />
        </>
      )}
      <MenuItem onClick={handleDrawArrow}>Draw arrow from here</MenuItem>
      {isOwnedByLocal && canAttach && (
        <MenuItem onClick={handleAttach}>Attach to card…</MenuItem>
      )}
      {isOwnedByLocal && canAttach && isAttached && (
        <MenuItem onClick={handleUnattach}>Unattach</MenuItem>
      )}
      {isOwnedByLocal && (
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
