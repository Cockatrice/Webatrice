import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

import { DialogFocus } from '../DialogFocus';

import './ConfirmDialog.css';

const PREFIX = 'ConfirmDialog';

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

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  cancelDefault?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  cancelDefault = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <StyledDialog
      className={'ConfirmDialog ' + classes.root}
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
        <DialogContent className="dialog-content confirm-dialog__body">
          <DialogContentText>{message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onCancel} autoFocus={cancelDefault}>{cancelLabel}</Button>
          <Button
            type="button"
            variant="contained"
            color={destructive ? 'error' : 'primary'}
            onClick={onConfirm}
            autoFocus={!cancelDefault}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogFocus>
    </StyledDialog>
  );
}

export default ConfirmDialog;
