import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';

import { memo, useMemo } from 'react';

import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import { useGameId } from '../../components/ui/GameIdContext';
import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import { activePlayersOf } from '../../utils/activePlayers';
import { useRevealCardsDialog } from './useRevealCardsDialog';

import './RevealCardsDialog.css';

const PREFIX = 'RevealCardsDialog';

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

export interface RevealCardsSubmit {
  targetPlayerId: number;
  topCards: number;
}

const ALL_PLAYERS = -1;

// Self-sources its reveal request (title/zone/count/onSubmit) from the
// GameDialogsContext.revealState slice, closes via closeReveal, and folds the
// reveal-target list (active, non-spectator, non-conceded seats — matching the
// board layout) from the store. Renders propless and self-gates.
function RevealCardsDialog() {
  const { revealState, closeReveal } = useGameDialogsContext();
  const gameId = useGameId();
  const game = useAppSelector((state) =>
    gameId != null ? games.Selectors.getGame(state, gameId) : undefined,
  );
  const players = useMemo(
    () =>
      (game ? activePlayersOf(game) : []).map((p) => ({
        playerId: p.properties.playerId,
        name: p.properties.userInfo?.name ?? `p${p.properties.playerId}`,
      })),
    [game],
  );

  const isOpen = revealState != null;
  const {
    targetPlayerId,
    countDraft,
    error,
    setTargetPlayerId,
    handleCountChange,
    handleSubmit,
  } = useRevealCardsDialog({
    isOpen,
    showCountInput: revealState?.showCountInput ?? false,
    defaultCount: revealState?.defaultCount ?? 1,
    onSubmit: revealState?.onSubmit,
  });

  if (!revealState) {
    return null;
  }

  const { title, zoneLabel } = revealState;
  const showCountInput = revealState.showCountInput;

  return (
    <StyledDialog
      className={'RevealCardsDialog ' + classes.root}
      open
      onClose={closeReveal}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          {title}
          <Typography variant="caption" component="span" className="reveal-cards-dialog__zone">
            From: {zoneLabel}
          </Typography>
        </div>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className="dialog-content reveal-cards-dialog__body">
          <FormControl fullWidth size="small" variant="outlined">
            <InputLabel id="reveal-target-label">Reveal to</InputLabel>
            <Select
              labelId="reveal-target-label"
              label="Reveal to"
              value={String(targetPlayerId)}
              onChange={(e) => setTargetPlayerId(Number(e.target.value))}
              slotProps={{ input: { 'aria-label': 'Reveal target' } }}
            >
              <MenuItem value={String(ALL_PLAYERS)}>All players</MenuItem>
              {players.map((p) => (
                <MenuItem key={p.playerId} value={String(p.playerId)}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {showCountInput && (
            <TextField
              autoFocus
              fullWidth
              variant="outlined"
              size="small"
              type="number"
              label="How many?"
              value={countDraft}
              onChange={(e) => handleCountChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              error={error != null}
              helperText={error ?? 'Enter a positive integer'}
              slotProps={{ htmlInput: { 'aria-label': 'Reveal count', min: 1 } }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeReveal}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">Reveal</Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}

export default memo(RevealCardsDialog);
