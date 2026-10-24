import { useTranslation } from 'react-i18next';

import { sortedTypeCounts } from '../../deckStats';
import type { CardTypeGroup } from '../../types';

export function TypeBreakdown({
  counts,
}: {
  counts: Partial<Record<CardTypeGroup, number>>;
}) {
  const { t } = useTranslation();
  const entries = sortedTypeCounts(counts);

  if (entries.length === 0) {
    return <div className="text-[12px] italic text-text-muted">{t('DeckBreakdown.noCards')}</div>;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
      {entries.map(([type, count]) => (
        <li key={type} className="flex items-center justify-between text-[12px]">
          <span className="truncate text-text-secondary">{t(`CardSearch.cardType.${type}`)}</span>
          <span className="tabular-nums text-text-primary">{count}</span>
        </li>
      ))}
    </ul>
  );
}
