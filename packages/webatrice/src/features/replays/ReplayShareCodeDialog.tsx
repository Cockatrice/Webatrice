import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export interface ReplayShareCodeDialogProps {
  code: string | null;
  onClose: () => void;
}

function ReplayShareCodeDialog({ code, onClose }: ReplayShareCodeDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard permission denied: the code stays selectable in the dialog.
    }
  };

  const close = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={code != null} onClose={close} aria-labelledby="replay-share-code-title">
      <DialogTitle id="replay-share-code-title">{t('Replays.share.codeTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('Replays.share.codeMessage')}</DialogContentText>
        <code className="replays-share-code" data-testid="replay-share-code">{code}</code>
      </DialogContent>
      <DialogActions>
        <Button onClick={copy}>{copied ? t('Replays.share.copied') : t('Replays.share.copy')}</Button>
        <Button variant="contained" onClick={close}>{t('Replays.share.ok')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReplayShareCodeDialog;
