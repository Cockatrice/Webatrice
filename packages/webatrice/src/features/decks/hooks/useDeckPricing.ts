import { useEffect, useMemo, useState } from 'react';

import { computeDeckPrice, emptyPriceLookup, fetchPricesForCards, type PriceLookup } from '../pricing';
import type { HydratedDeck } from '../types';

export function deckPriceKey(deck: HydratedDeck | null): string {
  if (!deck) {
    return '';
  }
  const tokens = deck.cards.map((c) =>
    c.scryfallId ? `id:${c.scryfallId}` : `name:${c.name.toLowerCase()}`,
  );
  return Array.from(new Set(tokens)).sort().join('|');
}

export interface DeckPricing {
  prices: PriceLookup;
  loading: boolean;
}

export function useDeckPricing(
  deck: HydratedDeck | null,
  persistPrice: (priceUsd: number | undefined, priceMissingCount: number | undefined) => void,
): DeckPricing {
  const [prices, setPrices] = useState<PriceLookup>(() => emptyPriceLookup());
  const [loading, setLoading] = useState(false);

  const priceKey = useMemo(() => deckPriceKey(deck), [deck]);

  useEffect(() => {
    if (!priceKey || !deck) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPricesForCards(deck.cards, (partial) => {
      if (cancelled) {
        return;
      }
      setPrices(partial);
    })
      .then(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `priceKey` fingerprints the priced fields of `deck.cards`
  }, [priceKey]);

  useEffect(() => {
    if (!deck || loading) {
      return;
    }
    const { total, missing } = computeDeckPrice(deck.cards, prices);
    persistPrice(
      total > 0 ? Number(total.toFixed(2)) : undefined,
      missing > 0 ? missing : undefined,
    );
  }, [deck, prices, loading, persistPrice]);

  return { prices, loading };
}
