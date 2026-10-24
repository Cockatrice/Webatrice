import { AtSign, Flag, MessageSquare, Swords, UserPlus, type LucideIcon } from 'lucide-react';

import { cx } from '@app/utils';

import { Avatar } from '../ds';
import type { NotificationInput, NotificationKind } from '@app/services';

export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  message: MessageSquare,
  mention: AtSign,
  buddy: UserPlus,
  game: Swords,
  report: Flag,
};

const KIND_TONE: Record<NotificationKind, { bg: string; fg: string }> = {
  message: { bg: 'bg-accent/15', fg: 'text-accent' },
  mention: { bg: 'bg-warning/15', fg: 'text-warning' },
  buddy: { bg: 'bg-success/15', fg: 'text-success' },
  game: { bg: 'bg-info/15', fg: 'text-info' },
  report: { bg: 'bg-bg-elevated', fg: 'text-text-secondary' },
};

export default function NotificationLead({ entry, size }: { entry: NotificationInput; size: number }) {
  const Icon = KIND_ICON[entry.kind];
  const tone = KIND_TONE[entry.kind];
  if ((entry.kind === 'message' || entry.kind === 'buddy') && entry.actor) {
    return (
      <span className="relative shrink-0" aria-hidden>
        <Avatar name={entry.actor} size={size} />
        {size > 30 && (
          <span
            className={cx(
              'absolute -bottom-1 -right-1 inline-flex h-[18px] w-[18px] items-center justify-center',
              'rounded-full border-2 border-bg-surface bg-bg-elevated',
              tone.fg,
            )}
          >
            <Icon size={10} />
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full', tone.bg, tone.fg)}
    >
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}
