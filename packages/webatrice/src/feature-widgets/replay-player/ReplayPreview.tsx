import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pause, Play, RotateCcw, RotateCw, SkipBack, SkipForward } from 'lucide-react';

import { games, type GameMessage } from '@cockatrice/datatrice';
import { Button, Chip, IconButton, Kbd } from '@app/components';
import { usePreference } from '@app/hooks';
import { BIG_SKIP_MS, SMALL_SKIP_MS, type OpenedReplay } from '@app/services';
import { useAppSelector } from '@app/store';
import { formatReplayTime } from '@app/utils';

import { GameLogRows as GameLogRowsView } from './GameLogRows';
import PreviewBoardView from './PreviewBoard';
import ReplayTimeline from './ReplayTimeline';
import { noReplayShortcuts, type ReplayShortcutBinder } from './replayShortcuts';
import { createTurnMarks, turnAt } from './replayTurnMarks';
import { usePreviewBoardModel } from './usePreviewBoardModel';
import { useReplayPlayback } from './useReplayPlayback';

const GameLogRows = memo(GameLogRowsView);
const PreviewBoard = memo(PreviewBoardView);
const EMPTY_MESSAGES: readonly GameMessage[] = [];

export interface ReplayPreviewProps {
  opened: OpenedReplay;
  onWatchFrom: (time: number) => void;
  useShortcuts?: ReplayShortcutBinder;
}

function ReplayPreview({ opened, onWatchFrom, useShortcuts = noReplayShortcuts }: ReplayPreviewProps) {
  const { t } = useTranslation();
  const playback = useReplayPlayback(opened, useShortcuts);
  const model = usePreviewBoardModel(opened.gameId);
  const turnMarks = useMemo(() => createTurnMarks(opened.replay, opened.engine.timeline), [opened]);
  const messages = useAppSelector((state) => games.Selectors.getMessages(state, opened.gameId));
  const players = useAppSelector((state) => games.Selectors.getPlayers(state, opened.gameId));
  const stampGameTime = usePreference('useGameTime');
  const logRef = useRef<HTMLDivElement>(null);
  const { state } = playback;
  const turn = turnAt(turnMarks, state.currentTime);

  useEffect(() => {
    const list = logRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="replay-preview">
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 min-w-0 flex-1">
          <PreviewBoard model={model} turn={turn} />
        </div>
        <div className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-ui border border-border-subtle bg-bg-sunken">
          <span className="border-b border-border-subtle px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {t('ReplayPreview.logAt', { time: formatReplayTime(state.currentTime) })}
          </span>
          <div
            ref={logRef}
            role="log"
            aria-label={t('ReplayPreview.logAt', { time: formatReplayTime(state.currentTime) })}
            className="scrollable min-h-0 flex-1 overflow-y-auto py-1 text-xs"
            data-testid="replay-preview-log"
          >
            <GameLogRows messages={messages ?? EMPTY_MESSAGES} players={players} stampGameTime={stampGameTime} />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1">
        <ReplayTimeline
          timeline={playback.timeline}
          currentTime={state.currentTime}
          maxTime={state.maxTime}
          onSeek={playback.seek}
          turnMarks={turnMarks}
          className="replay-timeline__frame !mx-0"
        />
        <div className="flex flex-wrap items-center gap-1">
          <IconButton size="sm" label={t('ReplayPreview.controls.backBig')} onClick={() => playback.skipBy(-BIG_SKIP_MS)}>
            <RotateCcw size={14} />
          </IconButton>
          <IconButton size="sm" label={t('ReplayPreview.controls.back')} onClick={() => playback.skipBy(-SMALL_SKIP_MS)}>
            <SkipBack size={14} />
          </IconButton>
          <IconButton
            size="sm"
            label={state.playing ? t('ReplayPreview.controls.pause') : t('ReplayPreview.controls.play')}
            active={state.playing}
            onClick={playback.togglePlay}
          >
            {state.playing ? <Pause size={15} /> : <Play size={15} />}
          </IconButton>
          <IconButton size="sm" label={t('ReplayPreview.controls.forward')} onClick={() => playback.skipBy(SMALL_SKIP_MS)}>
            <SkipForward size={14} />
          </IconButton>
          <IconButton size="sm" label={t('ReplayPreview.controls.forwardBig')} onClick={() => playback.skipBy(BIG_SKIP_MS)}>
            <RotateCw size={14} />
          </IconButton>
          <span className="ml-2 font-mono text-[12px] tabular-nums text-text-secondary" data-testid="replay-preview-time">
            {formatReplayTime(state.currentTime)} / {formatReplayTime(state.maxTime)}
          </span>
          {turn > 0 && <Chip className="ml-2">{t('ReplayPreview.turn', { turn })}</Chip>}
          <span className="ml-3 hidden items-center gap-1 text-[11px] text-text-muted lg:inline-flex">
            <Kbd>{t('ReplayPreview.keySpace')}</Kbd> {t('ReplayPreview.hintPlay')} <Kbd>←</Kbd>
            <Kbd>→</Kbd> {t('ReplayPreview.hintStep')}
          </span>
          <Button variant="primary" className="ml-auto" icon={<Play size={14} />} onClick={() => onWatchFrom(state.currentTime)}>
            {t('ReplayPreview.watchFrom', { time: formatReplayTime(state.currentTime) })}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReplayPreview;
