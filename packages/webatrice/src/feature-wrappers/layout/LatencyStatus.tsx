import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Popover from '@mui/material/Popover';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import LatencyGraph, { LatencySparkline } from './LatencyGraph';
import { CONNECTION_KEYS, useConnectionState, type ConnectionState } from './hooks/useConnectionState';

const DOT: Record<ConnectionState, string> = {
  connected: 'bg-success',
  stale: 'bg-warning',
  disconnected: 'bg-danger',
};

const LINE: Record<ConnectionState, string> = {
  connected: 'text-success',
  stale: 'text-warning',
  disconnected: 'text-danger',
};

export default function LatencyStatus() {
  const { t } = useTranslation();
  const { stats, samplesMs } = useAppSelector(server.Selectors.getLatency);
  const connection = useConnectionState();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const detailsId = useId();

  if (stats.sampleCount === 0) {
    return (
      <span className="flex h-6 items-center" title={t(CONNECTION_KEYS[connection])}>
        <span className={`h-2 w-2 rounded-full ${DOT[connection]}`} aria-hidden />
      </span>
    );
  }

  const details = [
    t('LatencyStatus.summary', { count: stats.sampleCount }),
    t('LatencyStatus.last', { ms: stats.lastMs }),
    t('LatencyStatus.median', { ms: stats.medianMs }),
    t('LatencyStatus.p95', { ms: stats.p95Ms }),
    t('LatencyStatus.max', { ms: stats.maxMs }),
  ].join('\n');

  return (
    <>
      <button
        type="button"
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className={[
          'flex w-16 flex-col items-center gap-0.5 rounded-ui py-1.5 text-[10.5px] tabular-nums text-text-muted',
          'hover:bg-bg-elevated hover:text-text-secondary',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        ].join(' ')}
        title={details}
        aria-label={t('LatencyStatus.ping', { ms: stats.lastMs })}
        aria-describedby={detailsId}
        aria-expanded={anchor !== null}
      >
        <span className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${DOT[connection]}`} aria-hidden />
          {t('LatencyStatus.short', { ms: stats.lastMs })}
        </span>
        <LatencySparkline samplesMs={samplesMs} width={40} height={10} className={LINE[connection]} />
      </button>
      <span id={detailsId} className="sr-only">{details}</span>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <div className="flex flex-col gap-2 p-2" role="group" aria-label={t('LatencyStatus.detailsName')}>
          <div className="whitespace-pre-line text-sm select-text">{details}</div>
          <LatencyGraph samplesMs={samplesMs} width={280} height={80} />
        </div>
      </Popover>
    </>
  );
}
