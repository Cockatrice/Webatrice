import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';

import { usePromptDialog } from './usePromptDialog';
import { DialogFocus } from '../DialogFocus';

import './PromptDialog.css';

const PREFIX = 'PromptDialog';

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

export interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  initialValue?: string;
  submitLabel?: string;
  helperText?: string;
  description?: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'password';
  inputMode?: 'text' | 'numeric';
  selectOnFocus?: boolean;
  preview?: (value: string) => string | null;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function PromptDialog({
  isOpen,
  title,
  label,
  initialValue = '',
  submitLabel = 'OK',
  helperText,
  description,
  placeholder,
  type = 'text',
  inputMode,
  selectOnFocus = false,
  preview,
  validate,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const { t } = useTranslation();
  const { value, error, handleChange, handleSubmit } = usePromptDialog({
    isOpen,
    initialValue,
    validate,
    onSubmit,
  });

  return (
    <StyledDialog
      className={'PromptDialog ' + classes.root}
      open={isOpen}
      disableRestoreFocus
      disableEnforceFocus
      onClose={onCancel}
      maxWidth={false}
    >
      <DialogFocus isOpen={isOpen}>
        <DialogTitle className="dialog-title">
          <div className="dialog-title__wrapper">
            {title}
          </div>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent className="dialog-content">
            {description && (
              <DialogContentText className="PromptDialog__description">{description}</DialogContentText>
            )}
            <TextField
              autoFocus
              fullWidth
              variant="outlined"
              size="small"
              label={label}
              value={value}
              type={type}
              placeholder={placeholder}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={selectOnFocus ? (e) => e.target.select() : undefined}
              error={error != null}
              helperText={error ?? preview?.(value) ?? helperText ?? ''}
              slotProps={{ htmlInput: { 'aria-label': label, inputMode } }}
            />
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={onCancel}>
              {t('Common.action.cancel')}
            </Button>
            <Button type="submit" variant="contained" color="primary">
              {submitLabel}
            </Button>
          </DialogActions>
        </form>
      </DialogFocus>
    </StyledDialog>
  );
}

export default PromptDialog;
