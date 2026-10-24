import { useTranslation } from 'react-i18next';

import { MANA_COLORS, type ManaColor } from '../../manaSymbols';

const PIP_HEX: Record<ManaColor, string> = {
  W: '#F8F0C4',
  U: '#4B92DB',
  B: '#4A3B60',
  R: '#E15C4F',
  G: '#4CA96A',
  C: '#B7B7C8',
};

export function ColorBar({ pips }: { pips: Record<ManaColor, number> }) {
  const { t } = useTranslation();
  const total = MANA_COLORS.reduce((s, c) => s + pips[c], 0);
  const present = MANA_COLORS.filter((c) => pips[c] > 0);
  const pct = (c: ManaColor) => Math.round((pips[c] / total) * 100);

  if (total === 0) {
    return <div className="h-2.5 rounded-full bg-bg-elevated" aria-hidden />;
  }

  const summary = present.map((c) => `${t(`CardSearch.color.${c}`)} ${pct(c)}%`).join(', ');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 overflow-hidden rounded-full" role="img" aria-label={t('DeckBreakdown.colorBar', { summary })}>
        {present.map((c) => (
          <span key={c} style={{ width: `${(pips[c] / total) * 100}%`, backgroundColor: PIP_HEX[c] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        {present.map((c) => (
          <li key={c} className="flex items-center gap-1.5" title={t(`CardSearch.color.${c}`)}>
            <span className="h-2 w-2 rounded-full ring-1 ring-black/20" style={{ backgroundColor: PIP_HEX[c] }} aria-hidden />
            <span className="text-text-secondary">{t(`CardSearch.color.${c}`)}</span>
            <span className="tabular-nums text-text-muted">{pct(c)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
