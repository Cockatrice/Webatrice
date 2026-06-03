import { ZoneName } from '@cockatrice/sockatrice';
import { memo, useEffect, useMemo, useState } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';

import { ZoneEntry, games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useGameId } from '../../components/ui/GameIdContext';
import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import './SideboardDialog.css';

const PREFIX = 'SideboardDialog';

const classes = {
  root: `${PREFIX}-root`,
};

const StyledDialog = styled(Dialog)(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .dialog-title__wrapper': {
      borderColor: theme.palette.grey[300],
    },
  },
}));

export interface SideboardPlanMove {
  cardName: string;
  startZone: string;
  targetZone: string;
}

type Card = { id: number; name: string };

function applyMoves(
  initialDeck: ReadonlyArray<Card>,
  initialSideboard: ReadonlyArray<Card>,
  moves: ReadonlyArray<SideboardPlanMove>,
): { deck: Card[]; sideboard: Card[] } {
  const deck = [...initialDeck];
  const sideboard = [...initialSideboard];
  for (const move of moves) {
    const from = move.startZone === ZoneName.DECK ? deck : sideboard;
    const to = move.targetZone === ZoneName.DECK ? deck : sideboard;
    const idx = from.findIndex((c) => c.name === move.cardName);
    if (idx < 0) {
      continue;
    }
    const [card] = from.splice(idx, 1);
    to.push(card);
  }
  return { deck, sideboard };
}

// Self-sources its open state + submit/cancel/lock handlers from
// GameDialogsContext, and folds the local player's name, deck/sideboard cards,
// and lock flag from the store, so Game renders it propless.
function SideboardDialog() {
  const {
    sideboardOpen: isOpen,
    handleSideboardSubmit: onSubmit,
    closeSideboard: onCancel,
    handleToggleSideboardLock: onToggleLock,
  } = useGameDialogsContext();
  const gameId = useGameId();
  const localPlayer = useAppSelector((state) =>
    gameId != null ? games.Selectors.getLocalPlayer(state, gameId) : undefined,
  );
  const playerName = localPlayer?.properties.userInfo?.name ?? '';
  // Keyed on the zone refs (stable unless the zone changes) so applyMoves below
  // doesn't recompute on every unrelated render.
  const deckZone = localPlayer?.zones[ZoneName.DECK];
  const sideboardZone = localPlayer?.zones[ZoneName.SIDEBOARD];
  const deckCards = useMemo(() => cardsFromZone(deckZone), [deckZone]);
  const sideboardCards = useMemo(() => cardsFromZone(sideboardZone), [sideboardZone]);
  const isLocked = localPlayer?.properties.sideboardLocked ?? false;

  const [moves, setMoves] = useState<SideboardPlanMove[]>([]);

  // Reset draft on open or server-side lock (resetSideboardPlan parity).
  useEffect(() => {
    if (isOpen || isLocked) {
      setMoves([]);
    }
  }, [isOpen, isLocked]);

  const { deck, sideboard } = useMemo(
    () => applyMoves(deckCards, sideboardCards, moves),
    [deckCards, sideboardCards, moves],
  );

  const addMove = (cardName: string, startZone: string, targetZone: string) => {
    setMoves((prev) => [...prev, { cardName, startZone, targetZone }]);
  };

  const handleMoveToSideboard = (card: Card) => {
    if (isLocked) {
      return;
    }
    addMove(card.name, ZoneName.DECK, ZoneName.SIDEBOARD);
  };

  const handleMoveToDeck = (card: Card) => {
    if (isLocked) {
      return;
    }
    addMove(card.name, ZoneName.SIDEBOARD, ZoneName.DECK);
  };

  const handleApply = () => {
    onSubmit(moves);
  };

  return (
    <StyledDialog
      className={'SideboardDialog ' + classes.root}
      open={isOpen}
      onClose={onCancel}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          Sideboard — {playerName}
          <FormControlLabel
            control={
              <Checkbox
                checked={isLocked}
                onChange={(e) => onToggleLock(e.target.checked)}
                slotProps={{ input: { 'aria-label': 'Lock sideboard' } }}
              />
            }
            label="Lock sideboard"
            className="sideboard-dialog__lock"
          />
        </div>
      </DialogTitle>
      <DialogContent className="dialog-content sideboard-dialog__body">
        {isLocked && (
          <div className="sideboard-dialog__locked-note" role="note">
            The sideboard is locked. Unlock to change your plan.
          </div>
        )}
        <div className="sideboard-dialog__columns">
          <section
            className="sideboard-dialog__column"
            aria-label={`Main deck (${deck.length})`}
          >
            <h3 className="sideboard-dialog__column-heading">
              Main deck ({deck.length})
            </h3>
            <ul className="sideboard-dialog__list scrollable" data-testid="sideboard-dialog-deck">
              {deck.map((card, idx) => (
                <li key={`${card.id}-${idx}`} className="sideboard-dialog__row">
                  <span className="sideboard-dialog__name">{card.name}</span>
                  <Tooltip title={`Move ${card.name} to sideboard`}>
                    <span>
                      <Button
                        type="button"
                        size="small"
                        onClick={() => handleMoveToSideboard(card)}
                        disabled={isLocked}
                        aria-label={`Move ${card.name} to sideboard`}
                      >
                        →
                      </Button>
                    </span>
                  </Tooltip>
                </li>
              ))}
              {deck.length === 0 && (
                <li className="sideboard-dialog__empty">(empty)</li>
              )}
            </ul>
          </section>
          <section
            className="sideboard-dialog__column"
            aria-label={`Sideboard (${sideboard.length})`}
          >
            <h3 className="sideboard-dialog__column-heading">
              Sideboard ({sideboard.length})
            </h3>
            <ul className="sideboard-dialog__list scrollable" data-testid="sideboard-dialog-sb">
              {sideboard.map((card, idx) => (
                <li key={`${card.id}-${idx}`} className="sideboard-dialog__row">
                  <Tooltip title={`Move ${card.name} to main deck`}>
                    <span>
                      <Button
                        type="button"
                        size="small"
                        onClick={() => handleMoveToDeck(card)}
                        disabled={isLocked}
                        aria-label={`Move ${card.name} to main deck`}
                      >
                        ←
                      </Button>
                    </span>
                  </Tooltip>
                  <span className="sideboard-dialog__name">{card.name}</span>
                </li>
              ))}
              {sideboard.length === 0 && (
                <li className="sideboard-dialog__empty">(empty)</li>
              )}
            </ul>
          </section>
        </div>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button
          type="button"
          variant="contained"
          color="primary"
          onClick={handleApply}
          disabled={isLocked || moves.length === 0}
        >
          Apply plan{moves.length > 0 ? ` (${moves.length})` : ''}
        </Button>
      </DialogActions>
    </StyledDialog>
  );
}

export default memo(SideboardDialog);

// Exported for tests and the Game.tsx wiring layer.
export { applyMoves };

// Helper to derive the card-display arrays a parent needs to pass.
// Takes the normalized ZoneEntry and materializes the
// [{id, name}] shape the dialog expects.
export function cardsFromZone(
  zone: ZoneEntry | undefined,
): Card[] {
  if (!zone) {
    return [];
  }
  return zone.order.map((id) => ({ id, name: zone.byId[id]?.name ?? '' }));
}
