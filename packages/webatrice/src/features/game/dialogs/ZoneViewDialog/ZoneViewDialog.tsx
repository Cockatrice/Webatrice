import { useEffect } from 'react';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

import { ServerInfo_Card } from '@cockatrice/sockatrice/generated';

import CardSlot from '../../components/ui/CardSlot/CardSlot';
import { makeCardKey } from '../../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../../utils/selection';
import { useZoneViewDialog } from './useZoneViewDialog';

import './ZoneViewDialog.css';

export interface ZoneViewDialogProps {
  isOpen: boolean;
  gameId: number | undefined;
  playerId: number | undefined;
  zoneName: string | undefined;
  handleClose: () => void;
  initialPosition?: { x: number; y: number };
  selectedCardKeys?: ReadonlySet<string>;
  onCardHover?: (card: ServerInfo_Card) => void;
  onCardFocus?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardBlur?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
  onCardContextMenu?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card, event: React.MouseEvent) => void;
  onCardDoubleClick?: (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => void;
}

const DEFAULT_POSITION = { x: 80, y: 80 };

function ZoneViewDialog({
  isOpen,
  gameId,
  playerId,
  zoneName,
  handleClose,
  initialPosition = DEFAULT_POSITION,
  selectedCardKeys = EMPTY_SELECTION,
  onCardHover,
  onCardFocus,
  onCardBlur,
  onCardClick,
  onCardContextMenu,
  onCardDoubleClick,
}: ZoneViewDialogProps) {
  const { cards, count, title, position, handlePointerDown, handlePointerMove, handlePointerUp } =
    useZoneViewDialog({ gameId, playerId, zoneName, initialPosition });

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleClose]);

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
          onClick={handleClose}
          size="small"
          aria-label="close zone view"
          className="zone-view-dialog__close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
      <div className="zone-view-dialog__body scrollable" data-zone-box-select="">
        {cards.length === 0 ? (
          <div className="zone-view-dialog__empty">
            {count > 0
              ? `${count} hidden card${count === 1 ? '' : 's'}`
              : 'This zone is empty.'}
          </div>
        ) : (
          <div className="zone-view-dialog__grid">
            {cards.map((card) => {
              const key =
                playerId != null && zoneName != null
                  ? makeCardKey(playerId, zoneName, card.id)
                  : null;
              return (
                <div key={card.id} className="zone-view-dialog__card" data-testid={`zone-view-card-${card.id}`}>
                  <CardSlot
                    card={card}
                    ownerPlayerId={playerId}
                    zone={zoneName}
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
    </div>
  );
}

export default ZoneViewDialog;
