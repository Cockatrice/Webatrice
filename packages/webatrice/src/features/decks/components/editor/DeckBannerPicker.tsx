import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { bannerCandidates, type BannerCandidate } from '../../deckTags';
import type { DeckCard } from '../../types';

export interface DeckBannerPickerProps {
  cards: readonly DeckCard[];
  bannerCard: string | undefined;
  bannerCardProviderId: string | undefined;
  onChange: (banner: BannerCandidate | null) => void;
}

const NONE = '';

function optionValue(candidate: BannerCandidate): string {
  return JSON.stringify([candidate.name, candidate.providerId ?? '']);
}

export function DeckBannerPicker({ cards, bannerCard, bannerCardProviderId, onChange }: DeckBannerPickerProps) {
  const { t } = useTranslation();
  const candidates = useMemo(() => {
    const list = bannerCandidates(cards);
    if (bannerCard && !list.some((c) => c.name === bannerCard && (c.providerId ?? '') === (bannerCardProviderId ?? ''))) {
      list.unshift({ name: bannerCard, providerId: bannerCardProviderId });
    }
    return list;
  }, [cards, bannerCard, bannerCardProviderId]);

  const selected = bannerCard ? optionValue({ name: bannerCard, providerId: bannerCardProviderId }) : NONE;
  const sets = useMemo(() => new Map(cards.map((c) => [`${c.name}|${c.scryfallId ?? ''}`, c.set])), [cards]);
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    }
    return counts;
  }, [candidates]);

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        {t('DeckBanner.label')}
      </span>
      <select
        value={selected}
        onChange={(e) => {
          const value = e.target.value;
          if (value === NONE) {
            onChange(null);
            return;
          }
          const [name, providerId] = JSON.parse(value) as [string, string];
          onChange({ name, providerId: providerId || undefined });
        }}
        className={[
          'mt-1 w-full rounded-md border border-border-subtle bg-bg-elevated px-2 py-1',
          'text-sm text-text-primary',
        ].join(' ')}
      >
        <option value={NONE}>-</option>
        {candidates.map((c) => {
          const set = sets.get(`${c.name}|${c.providerId ?? ''}`);
          const label = (nameCounts.get(c.name) ?? 0) > 1 && set ? `${c.name} (${set.toUpperCase()})` : c.name;
          return (
            <option key={optionValue(c)} value={optionValue(c)}>
              {label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
