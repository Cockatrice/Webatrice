import { ZoneName } from '@cockatrice/sockatrice';
import { useCallback, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

import { cx } from '@app/utils';

import CardSlot from '../../components/ui/CardSlot/CardSlot';
import { makeCardKey } from '../../utils/CardRegistry/CardRegistryContext';
import { useGameInteraction } from '../../components/ui/GameInteractionContext';
import { useCardVisualState } from '../../components/ui/CardVisualStateContext';
import { useGameId } from '../../components/ui/GameIdContext';
import { useGameAccess } from '../../hooks/useGameAccess';
import { useZoneViewDialog } from './useZoneViewDialog';

import './ZoneViewDialog.css';

export interface ZoneViewDialogProps {
  isOpen: boolean;
  playerId: number | undefined;
  zoneName: string | undefined;
  handleClose: (shuffleOnClose?: boolean) => void;
  initialPosition?: { x: number; y: number };
}

const DEFAULT_POSITION = { x: 80, y: 80 };

// Keeps its positional props (which seat/zone, where it opens, how it closes —
// all from the zoneViews stack entry) but self-sources the feature-global gameId
// and the shared selection set from context.
function ZoneViewDialog({
  isOpen,
  playerId,
  zoneName,
  handleClose,
  initialPosition = DEFAULT_POSITION,
}: ZoneViewDialogProps) {
  const gameId = useGameId();
  const { selectedCardKeys } = useCardVisualState();
  const { onCardHover, onCardFocus, onCardBlur, onCardClick, onCardContextMenu, onCardDoubleClick } =
    useGameInteraction();
  const { cards, count, title, position, handlePointerDown, handlePointerMove, handlePointerUp } =
    useZoneViewDialog({ gameId, playerId, zoneName, initialPosition });

  // Drags into/within the popup are gated by the same "can act on this seat"
  // rule as the board; the body is a drop target so cards can be dragged in.
  const { canAct } = useGameAccess(gameId, playerId);
  // Only targetZone is authoritative for a drop-in: the destination player is
  // resolved from the dragged card's owner tree (see moveTargetPlayerId), so a
  // targetPlayerId on this droppable would be ignored.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `zoneview-${playerId}-${zoneName}`,
    data: { targetZone: zoneName },
    disabled: !canAct || playerId == null || zoneName == null,
  });

  // "Shuffle on close" applies to the library only (desktop parity); defaults on.
  const isDeck = zoneName === ZoneName.DECK;
  const [shuffleOnClose, setShuffleOnClose] = useState(true);
  const onClose = useCallback(
    () => handleClose(isDeck ? shuffleOnClose : false),
    [handleClose, isDeck, shuffleOnClose],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="zone-view-dialog"
      role="dialog"
      aria-label={title}
      data-testid="zone-view-dialog"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="zone-view-dialog__header"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="zone-view-dialog__title">{title}</span>
        <IconButton
          onClick={() => onClose()}
          size="small"
          aria-label="close zone view"
          className="zone-view-dialog__close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <div
        ref={setDropRef}
        className={cx('zone-view-dialog__body scrollable', {
          'zone-view-dialog__body--drop-over': isOver,
        })}
        data-zone-box-select=""
      >
        {cards.length === 0 ? (
          <div className="zone-view-dialog__empty">
            {count > 0
              ? `${count} hidden card${count === 1 ? '' : 's'}`
              : 'This zone is empty.'}
          </div>
        ) : (
          <div className="zone-view-dialog__grid">
            {cards.map((card, index) => {
              const key =
                playerId != null && zoneName != null
                  ? makeCardKey(playerId, zoneName, card.id)
                  : null;
              return (
                <div key={card.id} className="zone-view-dialog__card" data-testid={`zone-view-card-${card.id}`}>
                  <CardSlot
                    card={card}
                    draggable={canAct}
                    ownerPlayerId={playerId}
                    zone={zoneName}
                    dropIndex={index}
                    isSelected={key != null && selectedCardKeys.has(key)}
                    onMouseEnter={onCardHover}
                    onFocus={onCardFocus}
                    onBlur={onCardBlur}
                    onClick={onCardClick}
                    onContextMenu={onCardContextMenu}
                    onDoubleClick={onCardDoubleClick}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isDeck && (
        <div className="zone-view-dialog__footer">
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={shuffleOnClose}
                onChange={(e) => setShuffleOnClose(e.target.checked)}
              />
            }
            label="Shuffle on close"
          />
        </div>
      )}
    </div>
  );
}

export default ZoneViewDialog;
