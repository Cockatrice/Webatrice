import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchAllPrintings, lookupCard, type PrintingSummary } from '@app/services';

import { emptyPriceLookup, fetchPricesForCards, type PriceLookup } from '../pricing';

export interface CardPrintings {
  canonicalName?: string;
  printings: PrintingSummary[];
  loading: boolean;
  error: string | null;
  prices: PriceLookup;
}

export function useCardPrintings(cardName: string | undefined): CardPrintings {
  const { t } = useTranslation();
  const [printings, setPrintings] = useState<PrintingSummary[]>([]);
  const [canonicalName, setCanonicalName] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<PriceLookup>(() => emptyPriceLookup());

  useEffect(() => {
    if (cardName === undefined) {
      return;
    }
    setPrintings([]);
    setCanonicalName(undefined);
    setPrices(emptyPriceLookup());
    setError(null);
    setLoading(true);
    const controller = new AbortController();
    (async () => {
      try {
        const scryfall = await fetchAllPrintings(cardName, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        let resolved: PrintingSummary[];
        if (scryfall.length > 0) {
          resolved = scryfall;
          setCanonicalName(scryfall[0].name ?? cardName);
        } else {
          const local = await lookupCard(cardName, controller.signal);
          if (controller.signal.aborted) {
            return;
          }
          resolved = local.printings;
          setCanonicalName(local.name);
        }
        setPrintings(resolved);
        setLoading(false);

        const cards = resolved
          .filter((p) => p.scryfallId)
          .map((p) => ({ scryfallId: p.scryfallId!, name: cardName }));
        if (cards.length > 0) {
          fetchPricesForCards(cards)
            .then((lookup) => {
              if (controller.signal.aborted) {
                return;
              }
              setPrices(lookup);
            })
            .catch(() => {
              /* silent — tiles just render without a price */
            });
        }
      } catch (e) {
        if (controller.signal.aborted) {
          return;
        }
        setError(e instanceof Error ? e.message : t('PrintingPicker.loadFailed'));
        setLoading(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [cardName, t]);

  return { printings, canonicalName, loading, error, prices };
}
