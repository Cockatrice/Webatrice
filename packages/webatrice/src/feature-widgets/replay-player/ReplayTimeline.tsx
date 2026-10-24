import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BIG_SKIP_MS, SMALL_SKIP_MS, createTimelineHistogram } from '@app/services';

import { formatReplayTime } from '@app/utils';
import type { TurnMark } from './replayTurnMarks';

export interface ReplayTimelineProps {
  timeline: readonly number[];
  currentTime: number;
  maxTime: number;
  onSeek: (time: number) => void;
  turnMarks?: readonly TurnMark[];
  className?: string;
}

function ReplayTimeline({ timeline, currentTime, maxTime, onSeek, turnMarks, className }: ReplayTimelineProps) {
  const { t } = useTranslation();

  const silhouette = useMemo(() => {
    const histogram = createTimelineHistogram(timeline);
    const peak = histogram.reduce((max, count) => Math.max(max, count), 1);
    const points = histogram.map((count, i) => `${i},${100 - (count / peak) * 100}`);
    return { width: histogram.length, path: `M0,100 L${points.join(' L')} L${histogram.length},100 Z` };
  }, [timeline]);

  const progress = maxTime > 0 ? Math.min(1, currentTime / maxTime) : 0;

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(Math.round(maxTime * fraction));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = {
      ArrowLeft: currentTime - SMALL_SKIP_MS,
      ArrowDown: currentTime - SMALL_SKIP_MS,
      ArrowRight: currentTime + SMALL_SKIP_MS,
      ArrowUp: currentTime + SMALL_SKIP_MS,
      PageDown: currentTime - BIG_SKIP_MS,
      PageUp: currentTime + BIG_SKIP_MS,
      Home: 0,
      End: maxTime,
    }[event.key];
    if (target === undefined || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onSeek(Math.min(maxTime, Math.max(0, target)));
  };

  const marks = maxTime > 0 && turnMarks?.length ? turnMarks : [];

  return (
    <div className={className ?? 'replay-timeline__frame'}>
      <div
        className="replay-timeline"
        role="slider"
        tabIndex={0}
        aria-label={t('GameReplay.timeline.label')}
        aria-valuemin={0}
        aria-valuemax={maxTime}
        aria-valuenow={currentTime}
        aria-valuetext={`${formatReplayTime(currentTime)} / ${formatReplayTime(maxTime)}`}
        data-testid="replay-timeline"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <svg
          className="replay-timeline__histogram"
          viewBox={`0 0 ${silhouette.width} 100`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={silhouette.path} />
        </svg>
        <div className="replay-timeline__progress" style={{ width: `${progress * 100}%` }} />
        {marks.map((mark) => (
          <span
            key={mark.turn}
            className="replay-timeline__tick"
            data-testid="replay-turn-tick"
            style={{ left: `${(mark.time / maxTime) * 100}%` }}
          />
        ))}
      </div>
      {marks.length > 0 && (
        <ol className="replay-timeline__turns" aria-label={t('GameReplay.timeline.turns')}>
          {marks.map((mark) => (
            <li
              key={mark.turn}
              className={mark.time <= currentTime ? 'replay-timeline__turn replay-timeline__turn--played' : 'replay-timeline__turn'}
              style={{ left: `${(mark.time / maxTime) * 100}%` }}
            >
              {t('GameReplay.timeline.turn', { turn: mark.turn })}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default ReplayTimeline;
