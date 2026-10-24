import { useTranslation } from 'react-i18next';

import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';

import { DialogFocus } from '../DialogFocus';

import './AlertDialog.css';

const PREFIX = 'AlertDialog';

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

export type AlertDialogSeverity = 'error' | 'warning' | 'info';

export interface AlertDialogNotice {
  title: string;
  message: string;
  severity: AlertDialogSeverity;
}

export interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  buttonLabel?: string;
  severity?: AlertDialogSeverity;
  onDismiss: () => void;
}

function AlertDialog({
  isOpen,
  title,
  message,
  details,
  buttonLabel = 'OK',
  severity = 'error',
  onDismiss,
}: AlertDialogProps) {
  const { t } = useTranslation();
  return (
    <StyledDialog
      className={'AlertDialog ' + classes.root}
      open={isOpen}
      disableRestoreFocus
      disableEnforceFocus
      onClose={onDismiss}
      maxWidth={false}
    >
      <DialogFocus isOpen={isOpen}>
        <DialogTitle className="dialog-title">
          <div className="dialog-title__wrapper">
            {title}
          </div>
        </DialogTitle>
        <DialogContent className="dialog-content alert-dialog__body">
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{message}</DialogContentText>
          {details && (
            <details key={details}>
              <summary>{t('AlertDialog.details')}</summary>
              <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{details}</DialogContentText>
            </details>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            variant="contained"
            color={severity === 'info' ? 'primary' : severity}
            onClick={onDismiss}
            autoFocus
          >
            {buttonLabel}
          </Button>
        </DialogActions>
      </DialogFocus>
    </StyledDialog>
  );
}

export default AlertDialog;
