import { useRef } from 'react';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';

import { useGameId } from '../../components/ui/GameIdContext';
import { useDeckSelectDialog } from './useDeckSelectDialog';

import './DeckSelectDialog.css';

const PREFIX = 'DeckSelectDialog';

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

// Self-sources the active gameId from context and its own open state (derived in
// useDeckSelectDialog), so Game renders it propless. Deck selection is mandatory
// before a game starts, so the dialog has no backdrop-dismiss close handler — the
// user leaves via the in-dialog "Leave Game" button.
function DeckSelectDialog() {
  const { t } = useTranslation();
  const gameId = useGameId();
  const {
    isOpen,
    deckText,
    setDeckText,
    fileName,
    handleFilePicked,
    validationError,
    deckHash,
    isReady,
    canSubmit,
    canToggleReady,
    handleSubmitDeck,
    handleToggleReady,
    handleLeave,
  } = useDeckSelectDialog(gameId);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <StyledDialog
      className={'DeckSelectDialog ' + classes.root}
      open={isOpen}
      maxWidth={false}
    >
      <DialogTitle className="dialog-title">
        <div className="dialog-title__wrapper">
          {t('DeckSelectDialog.title')}
        </div>
      </DialogTitle>
      <DialogContent className="dialog-content">
        <Typography className="dialog-content__subtitle" variant="subtitle1">
          {t('DeckSelectDialog.instructions')}
        </Typography>

        <div className="deck-select-dialog__file-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".cod"
            aria-label={t('DeckSelectDialog.deckFile')}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              handleFilePicked(file);
              e.target.value = '';
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('DeckSelectDialog.chooseFile')}
          </Button>
          <span className="deck-select-dialog__file-name">
            {fileName ?? t('DeckSelectDialog.noFile')}
          </span>
        </div>

        <Typography className="deck-select-dialog__divider" variant="caption">
          {t('DeckSelectDialog.pasteDivider')}
        </Typography>

        <textarea
          className="deck-select-dialog__textarea"
          rows={10}
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          placeholder={t('DeckSelectDialog.deckListPlaceholder')}
          aria-label={t('DeckSelectDialog.deckList')}
        />

        {validationError != null && (
          <div className="deck-select-dialog__error" role="alert">
            {validationError}
          </div>
        )}

        <div className="deck-select-dialog__hash">
          {t('DeckSelectDialog.deckHash', { hash: deckHash.length > 0 ? deckHash : '—' })}
        </div>

        <div className="deck-select-dialog__actions">
          <Button
            className="deck-select-dialog__leave"
            variant="text"
            color="error"
            onClick={handleLeave}
          >
            {t('DeckSelectDialog.leave')}
          </Button>
          <Button
            variant="outlined"
            onClick={handleSubmitDeck}
            disabled={!canSubmit}
          >
            {t('DeckSelectDialog.submit')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleToggleReady}
            disabled={!canToggleReady}
          >
            {isReady ? t('DeckSelectDialog.unready') : t('DeckSelectDialog.ready')}
          </Button>
        </div>
      </DialogContent>
    </StyledDialog>
  );
}

export default DeckSelectDialog;
