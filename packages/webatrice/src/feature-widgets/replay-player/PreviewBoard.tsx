import { useTranslation } from 'react-i18next';

import { ScryfallImageSize } from '@cockatrice/datatrice';
import { Avatar, CardImage, Chip } from '@app/components';
import { CARD_BACK_URL, getScryfallUrl } from '@app/services';
import { cx } from '@app/utils';

import type { PreviewBoardModel, PreviewCard, PreviewSeat } from './usePreviewBoardModel';

const CARD_WIDTH = 56;

const PHASE_KEYS = {
  0: 'ReplayPreview.phase.0',
  1: 'ReplayPreview.phase.1',
  2: 'ReplayPreview.phase.2',
  3: 'ReplayPreview.phase.3',
  4: 'ReplayPreview.phase.4',
  5: 'ReplayPreview.phase.5',
  6: 'ReplayPreview.phase.6',
  7: 'ReplayPreview.phase.7',
  8: 'ReplayPreview.phase.8',
  9: 'ReplayPreview.phase.9',
  10: 'ReplayPreview.phase.10',
} as const;


function PreviewCardTile({ card }: { card: PreviewCard }) {
  const src = card.faceDown ? CARD_BACK_URL : getScryfallUrl(card, ScryfallImageSize.Small);
  return (
    <span
      className={cx('relative inline-flex shrink-0', card.attached && '-ml-7 mt-3')}
      style={{ width: card.tapped ? CARD_WIDTH * 1.4 : CARD_WIDTH }}
      title={card.faceDown ? undefined : card.name}
      data-preview-card={card.id}
    >
      <CardImage
        src={src}
        name={card.faceDown ? undefined : card.name}
        draggable={false}
        className={cx('rounded-[3px] shadow-panel', card.tapped && 'rotate-90')}
        style={{ width: CARD_WIDTH, aspectRatio: '5 / 7', marginLeft: card.tapped ? CARD_WIDTH * 0.2 : 0 }}
      />
      {card.counters > 0 && (
        <span
          className={[
            'absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full',
            'bg-bg-base px-0.5 font-mono text-[9px] text-text-primary ring-1 ring-border-strong',
          ].join(' ')}
        >
          {card.counters}
        </span>
      )}
    </span>
  );
}

function Seat({ seat, flip }: { seat: PreviewSeat; flip?: boolean }) {
  const { t } = useTranslation();
  const name = seat.name ?? t('ReplayPreview.playerNumber', { id: seat.playerId });
  return (
    <section
      aria-label={t('ReplayPreview.seat', { name })}
      className={cx('flex min-h-0 flex-1 items-center gap-5 px-4 py-2', flip && 'flex-row')}
    >
      <div className="flex w-[124px] shrink-0 flex-col gap-0.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-text-primary">
          <Avatar name={name} size={20} ring={seat.isActive} />
          <span className="truncate">{name}</span>
        </span>
        <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-text-primary">
          {seat.life ?? '–'}
        </span>
        <span className="text-[11px] text-text-muted">
          {t('ReplayPreview.counts', { hand: seat.handCount, library: seat.libraryCount })}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 overflow-hidden">
        {seat.battlefield.length === 0 && (
          <span className="text-[11px] italic text-text-muted">{t('ReplayPreview.emptyBattlefield')}</span>
        )}
        {seat.battlefield.map((card) => (
          <PreviewCardTile key={card.id} card={card} />
        ))}
      </div>
    </section>
  );
}

export interface PreviewBoardProps {
  model: PreviewBoardModel;
  turn: number;
}

function PreviewBoard({ model, turn }: PreviewBoardProps) {
  const { t } = useTranslation();
  const [bottom, ...others] = model.seats;
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-ui bg-table-felt" data-testid="replay-preview-board">
      {others.map((seat) => (
        <Seat key={seat.playerId} seat={seat} flip />
      ))}
      <div className="mx-4 flex min-h-[26px] items-center gap-2 border-y border-table-rim py-1 text-[11px] text-text-secondary">
        {model.phase !== undefined && model.phase in PHASE_KEYS && (
          <Chip tone="accent">
            {t('ReplayPreview.turnStrip', {
              turn,
              player: model.activePlayerName ?? '',
              phase: t(PHASE_KEYS[model.phase as keyof typeof PHASE_KEYS]),
            })}
          </Chip>
        )}
        {model.stack.length > 0 && (
          <>
            <span className="text-text-muted">{t('ReplayPreview.stack')}</span>
            <span className="truncate text-text-primary">{model.stack.join(' → ')}</span>
          </>
        )}
      </div>
      {bottom && <Seat seat={bottom} />}
    </div>
  );
}

export default PreviewBoard;
