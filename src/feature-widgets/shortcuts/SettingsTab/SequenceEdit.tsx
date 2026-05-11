import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';

import { ShortcutsDispatch, ShortcutsSelectors, useAppSelector } from '@app/store';

import { displaySequence } from '../shortcutSequence';
import { ActionId } from '../types';

interface SequenceEditProps {
  actionId: ActionId;
  onClose: () => void;
}

const SequenceEdit = ({ actionId, onClose }: SequenceEditProps) => {
  const { t } = useTranslation();
  const sequences = useAppSelector(ShortcutsSelectors.getRecordingSequences);
  const recordingActionId = useAppSelector(ShortcutsSelectors.getRecordingActionId);

  // Start recording on open. The cleanup cancels recording so leaving the dialog any
  // way (Save, Cancel, dismiss) clears the slice's capture state.
  useEffect(() => {
    ShortcutsDispatch.startRecording(actionId);
    return () => {
      ShortcutsDispatch.cancelRecording();
    };
  }, [actionId]);

  // Provider's Esc-during-recording handler dispatches cancelRecording. When we observe
  // the slice flip to null while we're still mounted, treat it as the user dismissing.
  // Branch decisions key off the captured recordingActionId, not on a "first run"
  // sentinel — see plan: this version complies with React 18 StrictMode's effect
  // double-invoke (refs are preserved across cleanup→re-setup, which would corrupt a
  // run-count-based sentinel like `initialMount`).
  const hasRecorded = useRef(false);
  useEffect(() => {
    if (recordingActionId !== null) {
      hasRecorded.current = true;
      return;
    }
    if (hasRecorded.current) {
      onClose();
    }
  }, [recordingActionId, onClose]);

  const handleSave = () => {
    ShortcutsDispatch.setOverride(actionId, sequences);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t(`ShortcutsTab.action.${actionId}`)}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{t('ShortcutsTab.recording')}</Typography>
        <div className="SequenceEdit__chips">
          {sequences.length === 0 ? (
            <span className="SequenceEdit__placeholder">{t('ShortcutsTab.noBinding')}</span>
          ) : (
            sequences.map((seq) => (
              <Chip
                key={seq}
                label={displaySequence(seq)}
                size="small"
                onDelete={() => ShortcutsDispatch.removeCapturedSequence(seq)}
              />
            ))
          )}
        </div>
        <Typography variant="caption" color="text.secondary">
          {t('ShortcutsTab.recordingHint')}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('ShortcutsTab.cancel')}</Button>
        <Button variant="contained" color="primary" onClick={handleSave}>
          {t('ShortcutsTab.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SequenceEdit;
