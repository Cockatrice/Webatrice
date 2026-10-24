import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { classifyLogTone, games, type GameMessage, type LogSegment, type LogTone, type PlayerEntry } from '@cockatrice/datatrice';
import { renderGameLinks } from '@app/components';

import { formatLogDescriptor } from './formatLogDescriptor';
import { logRowKey } from './logRowKey';

const TONE_CLASS: Record<LogTone, string> = {
  turn: 'text-success font-semibold',
  phase: 'text-sky-400 light:text-sky-700',
  system: 'text-rose-400 light:text-rose-700 italic',
  action: 'text-text-primary/85',
};

const SEGMENT_CLASS: Record<LogSegment['kind'], string> = {
  plain: '',
  player: 'font-semibold text-text-primary',
  card: 'italic text-accent hover:text-accent-hover cursor-pointer underline decoration-dotted underline-offset-2',
  number: 'font-semibold text-cyan-300 light:text-cyan-700 tabular-nums',
};

export function formatElapsedSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function stripeClass(index: number): string {
  return index % 2 === 0 ? 'bg-transparent' : 'bg-black/15';
}

function formatWallClock(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface GameLogRowsProps {
  messages: readonly GameMessage[];
  players: Record<number, PlayerEntry> | undefined;
  stampGameTime: boolean;
  onCardHover?: (card: { name: string } | null) => void;
  onCardBigPreview?: (card: { name: string }, open: boolean) => void;
  renderSender?: (senderName: string) => ReactNode;
}

interface GameLogRowContentProps {
  message: GameMessage;
  senderName: string | undefined;
  stampGameTime: boolean;
  onCardHover?: (card: { name: string } | null) => void;
  onCardBigPreview?: (card: { name: string }, open: boolean) => void;
  renderSender?: (senderName: string) => ReactNode;
}

const GameLogRowContent = memo(function GameLogRowContent({
  message: m,
  senderName,
  stampGameTime,
  onCardHover,
  onCardBigPreview,
  renderSender,
}: GameLogRowContentProps) {
  const { t } = useTranslation();
  const name = senderName || t('GameLog.player.number', { id: m.playerId });
  const stamp = stampGameTime && m.gameSeconds !== undefined
    ? `[${formatElapsedSeconds(m.gameSeconds)}]`
    : m.timeReceived
      ? `[${formatWallClock(m.timeReceived)}]`
      : null;

  if (m.kind === 'event') {
    const formatted = m.descriptor ? formatLogDescriptor(m.descriptor, t) : { text: m.message, segments: m.segments };
    return (
      <>
        {stamp && <span className="text-text-muted font-normal not-italic tabular-nums mr-1.5">{stamp}</span>}
        {formatted.segments && formatted.segments.length > 0
          ? formatted.segments.map((seg, si) => (
            seg.kind === 'card' ? (
              <span
                key={si}
                className={SEGMENT_CLASS.card}
                onMouseEnter={() => onCardHover?.({ name: seg.text })}
                onMouseLeave={() => onCardHover?.(null)}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onCardBigPreview?.({ name: seg.text }, true);
                  }
                }}
                onMouseUp={(e) => {
                  if (e.button === 1) {
                    onCardBigPreview?.({ name: seg.text }, false);
                  }
                }}
              >
                {seg.text}
              </span>
            ) : (
              <span key={si} className={SEGMENT_CLASS[seg.kind]}>{seg.text}</span>
            )
          ))
          : formatted.text}
      </>
    );
  }

  return (
    <>
      {stamp && <span className="text-text-muted font-normal tabular-nums mr-1.5">{stamp}</span>}
      <span className="font-semibold text-accent">
        {senderName && renderSender ? renderSender(senderName) : name}:
      </span>{' '}
      <span>{renderGameLinks(m.message)}</span>
    </>
  );
});

export const GameLogRows = memo(function GameLogRows({
  messages,
  players,
  stampGameTime,
  onCardHover,
  onCardBigPreview,
  renderSender,
}: GameLogRowsProps) {
  return (
    <>
      {messages.map((m, idx) => {
        const senderName = m.senderName ?? players?.[m.playerId]?.properties.userInfo?.name;
        const stripe = stripeClass(idx);
        if (m.kind === 'event') {
          const tone = m.descriptor ? games.logTone(m.descriptor.kind) : classifyLogTone(m.message);
          return (
            <div
              key={logRowKey(m)}
              data-tone={tone}
              data-log-kind={m.descriptor?.kind}
              className={['px-3 py-0.5 leading-snug break-words', TONE_CLASS[tone], stripe].join(' ')}
            >
              <GameLogRowContent
                message={m}
                senderName={senderName}
                stampGameTime={stampGameTime}
                onCardHover={onCardHover}
                onCardBigPreview={onCardBigPreview}
                renderSender={renderSender}
              />
            </div>
          );
        }
        return (
          <div key={logRowKey(m)} className={['px-3 py-0.5 text-text-primary leading-snug break-words', stripe].join(' ')}>
            <GameLogRowContent
              message={m}
              senderName={senderName}
              stampGameTime={stampGameTime}
              onCardHover={onCardHover}
              onCardBigPreview={onCardBigPreview}
              renderSender={renderSender}
            />
          </div>
        );
      })}
    </>
  );
});
