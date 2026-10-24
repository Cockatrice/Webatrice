import { memo } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

import { useGameDialogsContext } from '../../components/ui/GameDialogsContext';
import { useRollDieDialog } from './useRollDieDialog';

import './RollDieDialog.css';

const PREFIX = 'RollDieDialog';

const classes = {
  root: `${PREFIX}-root`,
};

const StyledDialog = styled(Dialog)(({ theme }) => ({
  [`&.${classes.root}`]: {
    '& .dialog-title__wrapper': {
      borderColor: theme.palette.divider,
    },
  },
}));

export const DEFAULT_DIE_SIDES = 6;
export const DEFAULT_DIE_COUNT = 1;

// Self-sources its open state, the seeded last-roll values, and the submit /
// cancel handlers from GameDialogsContext, so Game renders it propless.
function RollDieDialog() {
  const { t } = useTranslation();
  const { rollDieOpen, lastDieSides, lastDieCount, handleRollDieSubmit, closeRollDie } =
    useGameDialogsContext();
  const { sides, count, error, handleSidesChange, handleCountChange, handleSubmit } =
    useRollDieDialog({
      isOpen: rollDieOpen,
      lastSides: lastDieSides,
      lastCount: lastDieCount,
      onSubmit: handleRollDieSubmit,
    });

  return (
    <StyledDialog
      className={'RollDieDialog ' + classes.root}
      open={rollDieOpen}
      onClose={closeRollDie}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          {t('RollDieDialog.title')}
        </div>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent className="dialog-content">
          <TextField
            autoFocus
            fullWidth
            variant="outlined"
            size="small"
            label={t('RollDieDialog.sides')}
            value={sides}
            onChange={(e) => handleSidesChange(e.target.value)}
            error={error?.field === 'sides'}
            helperText={error?.field === 'sides' ? error.message : ''}
            slotProps={{ htmlInput: { 'aria-label': t('RollDieDialog.sides'), inputMode: 'numeric' } }}
          />
          <TextField
            fullWidth
            variant="outlined"
            size="small"
            label={t('RollDieDialog.count')}
            value={count}
            onChange={(e) => handleCountChange(e.target.value)}
            error={error?.field === 'count'}
            helperText={error?.field === 'count' ? error.message : ''}
            slotProps={{ htmlInput: { 'aria-label': t('RollDieDialog.count'), inputMode: 'numeric' } }}
            sx={{ marginTop: '12px' }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeRollDie}>{t('Common.action.cancel')}</Button>
          <Button type="submit" variant="contained" color="primary">{t('RollDieDialog.roll')}</Button>
        </DialogActions>
      </form>
    </StyledDialog>
  );
}

export default memo(RollDieDialog);
