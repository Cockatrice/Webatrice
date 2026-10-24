import { useTranslation } from 'react-i18next';

import { CURVE_BUCKETS } from '../../deckStats';

export function ManaCurve({ curve, height = 78 }: { curve: Record<number, number>; height?: number }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...CURVE_BUCKETS.map((b) => curve[b] ?? 0));
  const summary = CURVE_BUCKETS
    .map((b) => `${b === 7 ? t('DeckBreakdown.curve.sevenPlus') : b}: ${curve[b] ?? 0}`)
    .join(', ');
  return (
    <div
      className="flex items-end gap-1.5"
      style={{ height }}
      role="img"
      aria-label={t('DeckBreakdown.curve.label', { summary })}
    >
      {CURVE_BUCKETS.map((b) => {
        const count = curve[b] ?? 0;
        const bucket = b === 7 ? t('DeckBreakdown.curve.sevenPlus') : String(b);
        return (
          <div key={b} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10.5px] tabular-nums leading-none text-text-secondary">{count > 0 ? count : ''}</span>
            <span
              className={count > 0 ? 'w-full rounded-t-[3px] bg-accent' : 'w-full rounded-t-[3px] bg-border-subtle'}
              style={{ height: count > 0 ? `${(count / max) * 100}%` : '2px' }}
              title={t('DeckBreakdown.curve.barTitle', { count, cmc: bucket })}
            />
            <span className="text-[10.5px] tabular-nums leading-none text-text-muted">{bucket}</span>
          </div>
        );
      })}
    </div>
  );
}
