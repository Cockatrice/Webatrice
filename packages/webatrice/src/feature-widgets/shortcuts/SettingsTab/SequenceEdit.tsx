import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { shortcuts, useAppDispatch, useAppSelector } from '@app/store';

import { ActionId } from '../types';
import { KeycapSequence } from './Keycap';

interface SequenceEditProps {
  actionId: ActionId;
  onClose: () => void;
}

const SequenceEdit = ({ actionId, onClose }: SequenceEditProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sequences = useAppSelector(shortcuts.Selectors.getRecordingSequences);
  const recordingActionId = useAppSelector(shortcuts.Selectors.getRecordingActionId);

  // Start recording on open. The cleanup cancels recording so leaving the dialog any
  // way (Save, Cancel, dismiss) clears the slice's capture state.
  useEffect(() => {
    dispatch(shortcuts.Actions.startRecording({ actionId }));
    return () => {
      dispatch(shortcuts.Actions.cancelRecording());
    };
  }, [dispatch, actionId]);

  // Slice flip to null while mounted = user dismiss (Esc). Branch on captured recordingActionId, not a mount sentinel (StrictMode-safe).
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
    dispatch(shortcuts.Actions.setOverride({ actionId, sequences }));
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-lg bg-bg-surface border border-border-subtle shadow-glow overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-modern text-base font-semibold text-text-primary">
            {t(`ShortcutsTab.action.${actionId}`)}
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            {t('ShortcutsTab.recording')}
          </p>
        </div>
        <div className="px-4 py-3">
          <div className="flex flex-col gap-1.5 min-h-[44px] p-2 mb-2 rounded-md border border-dashed border-border-subtle bg-bg-base">
            {sequences.length === 0 ? (
              <span className="italic text-xs text-text-muted self-center">
                {t('ShortcutsTab.noBinding')}
              </span>
            ) : (
              sequences.map((seq) => (
                <span key={seq} className="inline-flex items-center gap-1">
                  <KeycapSequence sequence={seq} />
                  <button
                    type="button"
                    onClick={() =>
                      dispatch(shortcuts.Actions.removeCapturedSequence({ sequence: seq }))
                    }
                    aria-label={t('ShortcutsTab.removeBinding')}
                    title={t('ShortcutsTab.removeBinding')}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            )}
          </div>
          <p className="text-[11px] text-text-muted leading-snug">
            {t('ShortcutsTab.recordingHint')}
          </p>
        </div>
        <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            {t('ShortcutsTab.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover shadow-glow transition-colors"
          >
            {t('ShortcutsTab.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SequenceEdit;
