import { forwardRef, type ReactNode } from 'react';

import { cx } from '@app/utils';

export interface CollapsedPaneRailProps {
  side: 'left' | 'right';
  title: string;
  expandLabel: string;
  icon: ReactNode;
  onExpand: () => void;
}

export const CollapsedPaneRail = forwardRef<HTMLButtonElement, CollapsedPaneRailProps>(function CollapsedPaneRail(
  { side, title, expandLabel, icon, onExpand },
  ref,
) {
  return (
    <div
      className={cx(
        'flex h-full min-h-0 flex-col items-center bg-bg-surface py-2',
        side === 'right' ? 'border-l border-border-subtle' : '',
      )}
    >
      <button
        ref={ref}
        type="button"
        onClick={onExpand}
        aria-label={expandLabel}
        title={expandLabel}
        className={cx(
          'flex min-h-0 w-9 flex-col items-center gap-3 rounded-ui py-2 text-text-secondary transition-colors',
          'hover:bg-bg-elevated hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
        )}
      >
        {icon}
        <span aria-hidden className="whitespace-nowrap font-display text-[12px] font-semibold [writing-mode:vertical-rl]">
          {title}
        </span>
      </button>
    </div>
  );
});
