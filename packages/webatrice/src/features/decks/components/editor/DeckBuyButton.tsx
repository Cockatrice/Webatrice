import { useMemo } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@app/components';

import {
  buildTcgMassEntryUrl,
  computeDeckPrice,
  pricingProgress,
  unpricedCards,
  type PriceLookup,
} from '../../pricing';
import type { DeckCard } from '../../types';

const LINK_CLASS = [
  'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-ui bg-accent px-3.5 text-[13px] font-medium',
  'text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline focus-visible:outline-2',
  'focus-visible:outline-offset-2 focus-visible:outline-accent',
].join(' ');

export function DeckBuyButton({
  cards,
  prices,
  loading,
}: {
  cards: DeckCard[];
  prices: PriceLookup;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { total, missing } = useMemo(() => computeDeckPrice(cards, prices), [cards, prices]);
  const href = useMemo(() => buildTcgMassEntryUrl(cards), [cards]);
  const { pricedUnique, totalUnique } = useMemo(() => pricingProgress(cards, prices), [cards, prices]);
  const missingNames = useMemo(
    () => (loading ? [] : unpricedCards(cards, prices).map(({ name, qty }) => `${qty}× ${name}`)),
    [cards, prices, loading],
  );

  const label = t('DeckEditor.buy.deck', { total: total.toFixed(2) });
  if (cards.length === 0) {
    return (
      <Button variant="primary" disabled icon={<ShoppingCart size={14} />} title={t('DeckEditor.buy.disabled')}>
        {label}
      </Button>
    );
  }

  const title = loading
    ? t('DeckEditor.buy.pricing', {
      count: Math.max(0, totalUnique - pricedUnique), priced: String(pricedUnique), total: String(totalUnique),
    })
    : missing > 0
      ? `${t('DeckEditor.buy.missing', { count: missing })}: ${missingNames.join(', ')}`
      : t('DeckEditor.buy.openDeck');

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={LINK_CLASS}>
      {loading ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
      {label}
      {!loading && missing > 0 && (
        <span className="text-[11px] font-normal opacity-80">{t('DeckEditor.buy.missingShort', { count: missing })}</span>
      )}
    </a>
  );
}
