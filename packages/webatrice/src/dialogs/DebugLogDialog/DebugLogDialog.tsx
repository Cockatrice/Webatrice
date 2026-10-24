import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardCopy, Eraser } from 'lucide-react';

import { LoadingState, usePreference, useSettings } from '@app/hooks';
import { debugLog, formatLogEntry } from '@app/services';

import DialogShell from '../DialogShell/DialogShell';

const BUTTON_CLASS = [
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap',
  'bg-bg-elevated text-text-primary border border-border-subtle hover:border-accent transition-colors',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border-subtle',
].join(' ');

export interface DebugLogDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DebugLogDialog({ isOpen, onClose }: DebugLogDialogProps) {
  return isOpen ? <OpenDebugLogDialog onClose={onClose} /> : null;
}

function OpenDebugLogDialog({ onClose }: Pick<DebugLogDialogProps, 'onClose'>) {
  const { t } = useTranslation();
  const entries = useSyncExternalStore(debugLog.subscribe, debugLog.getEntries);
  const clearOnClose = usePreference('clearDebugLogOnClose');
  const settings = useSettings();
  const [copied, setCopied] = useState<'done' | 'failed' | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const text = [...debugLog.getHeader(), ...entries.map(formatLogEntry)].join('\n');

  useEffect(() => {
    const area = textRef.current;
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }, [text]);

  const close = () => {
    if (clearOnClose) {
      debugLog.clear();
    }
    onClose();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(debugLog.toText());
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <DialogShell isOpen handleClose={close} title={t('DebugLogDialog.title')} maxWidth="max-w-3xl">
      <div className="flex flex-col gap-3">
        <textarea
          ref={textRef}
          className={[
            'w-full h-[55vh] resize-none rounded-md p-3 font-mono text-xs leading-relaxed',
            'bg-bg-base text-text-primary border border-border-subtle focus:outline-none focus:border-accent',
          ].join(' ')}
          readOnly
          spellCheck={false}
          value={text}
          aria-label={t('DebugLogDialog.logLabel')}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              checked={clearOnClose}
              disabled={settings.status !== LoadingState.READY}
              onChange={(e) => void settings.update({ clearDebugLogOnClose: e.target.checked })}
            />
            {t('DebugLogDialog.clearOnClose')}
          </label>
          <span className="flex-1" />
          <span role="status" className={copied === 'done' ? 'text-success' : 'text-danger'}>
            {copied && t(copied === 'done' ? 'DebugLogDialog.copied' : 'DebugLogDialog.copyFailed')}
          </span>
          <button
            type="button"
            className={BUTTON_CLASS}
            onClick={() => debugLog.clear()}
            disabled={entries.length === 0}
          >
            <Eraser size={14} aria-hidden />
            {t('DebugLogDialog.clear')}
          </button>
          <button type="button" className={BUTTON_CLASS} onClick={() => void copy()}>
            {copied === 'done' ? <Check size={14} aria-hidden /> : <ClipboardCopy size={14} aria-hidden />}
            {t('DebugLogDialog.copy')}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
