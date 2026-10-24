import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { useResolvedBinding } from '@app/feature-widgets/shortcuts';
import { usePreference } from '@app/hooks';
import type { PrintingSummary } from '@app/services';
import { isCommanderFormat } from '@app/types';

import { buildScryfallQuery, type SearchFiltersState } from '../../cardSearchQuery';
import { useCardPrintings } from '../../hooks/useCardPrintings';
import type { PriceLookup } from '../../pricing';
import { bumpPrintingsInDeck } from '../../printingOrder';
import type { ScryfallSearchCard, ScryfallSearchFailure } from '../../search';
import type { DeckCard } from '../../types';
import {
  clampHighlight,
  deckQuantities,
  isImeComposition,
  dockKeyZone,
  gameChangerNote,
  initialDockFilters,
  moveHighlight,
  shouldSearch,
  type DockView,
  type DockZone,
  type GameChangerNote,
} from './dockModel';
import { useCardDatabase } from './useCardDatabase';
import { useGameChangerList } from './useGameChangerList';

export const PRINTINGS_DELAY_MS = 250;

export interface CardSearchDockOptions {
  onAdd: (cardName: string, zone: DockZone, providerId?: string) => void;
  onSelect?: (cardName: string) => void;
  onPreview?: (card: ScryfallSearchCard, providerId?: string) => void;
  colorIdentity?: readonly string[];
  format?: string;
  deckCards?: readonly DeckCard[];
}

export interface CardSearchDockState {
  text: string;
  setText: (text: string) => void;
  filters: SearchFiltersState;
  setFilters: (filters: SearchFiltersState) => void;
  composedQuery: string;
  results: ScryfallSearchCard[];
  total: number;
  stale: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: ScryfallSearchFailure | null;
  hasMore: boolean;
  loadMore: () => void;
  highlight: number;
  setHighlight: (index: number) => void;
  selected: ScryfallSearchCard | null;
  quantities: Map<string, number>;
  add: (index: number, zone: DockZone) => void;
  lastAdded: { name: string; zone: DockZone } | null;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  view: DockView;
  setView: (view: DockView) => void;
  printings: PrintingSummary[];
  printingsLoading: boolean;
  printingPrices: PriceLookup;
  printingName: string | null;
  chosenPrinting: string | undefined;
  printingChoices: Readonly<Record<string, string>>;
  choosePrinting: (scryfallId: string | undefined) => void;
  gameChanger: GameChangerNote;
  keys: { main: string[]; side: string[] };
}

function useDelayed<T>(value: T, ms: number): T {
  const [delayed, setDelayed] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDelayed(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return delayed;
}

export function useCardSearchDock({
  onAdd, onSelect, onPreview, colorIdentity, format, deckCards,
}: CardSearchDockOptions): CardSearchDockState {
  const [text, setText] = useState('');
  const [filters, setFiltersState] = useState<SearchFiltersState>(() => initialDockFilters(colorIdentity, format));
  const coloursTouched = useRef(false);
  const [view, setView] = useState<DockView>('list');
  const [picked, setPicked] = useState<{ query: string; index: number }>({ query: '', index: 0 });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [lastAdded, setLastAdded] = useState<{ name: string; zone: DockZone } | null>(null);

  const hasIdentity = (colorIdentity?.length ?? 0) > 0;
  useEffect(() => {
    if (hasIdentity && !coloursTouched.current) {
      setFiltersState((f) => (f.colorMode === 'includes' && f.colors.length === 0 ? { ...f, colorMode: 'withinIdentity' } : f));
    }
  }, [hasIdentity]);

  const setFilters = useCallback((next: SearchFiltersState) => {
    coloursTouched.current = true;
    setFiltersState(next);
  }, []);

  const composedQuery = useMemo(
    () => (shouldSearch(text, filters) ? buildScryfallQuery(text, filters, { identity: colorIdentity, format }) : ''),
    [text, filters, colorIdentity, format],
  );
  const db = useCardDatabase(composedQuery);

  const highlight = clampHighlight(picked.query === composedQuery ? picked.index : 0, db.results.length);
  const setHighlight = useCallback((index: number) => setPicked({ query: composedQuery, index }), [composedQuery]);

  const selected = highlight >= 0 ? db.results[highlight] ?? null : null;
  const selectedName = selected?.name ?? null;

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useEffect(() => {
    if (selectedName) {
      onSelectRef.current?.(selectedName);
    }
  }, [selectedName]);

  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  const chosenForSelected = selectedName ? choices[selectedName] : undefined;
  useEffect(() => {
    if (selected) {
      onPreviewRef.current?.(selected, chosenForSelected);
    }
  }, [selected, chosenForSelected]);

  const printingName = useDelayed(selectedName, PRINTINGS_DELAY_MS);
  const { printings: allPrintings, loading: printingsLoading, prices: printingPrices } = useCardPrintings(printingName ?? undefined);
  const bumpSetsInDeck = usePreference('bumpSetsWithCardsInDeckToTop');
  const printings = useMemo(
    () => (bumpSetsInDeck && printingName && deckCards ? bumpPrintingsInDeck(allPrintings, printingName, deckCards) : allPrintings),
    [allPrintings, bumpSetsInDeck, deckCards, printingName],
  );

  const quantities = useMemo(() => deckQuantities(deckCards), [deckCards]);

  const add = useCallback(
    (index: number, zone: DockZone) => {
      const card = db.fresh ? db.results[index] : undefined;
      if (!card) {
        return;
      }
      setHighlight(index);
      onAdd(card.name, zone, choices[card.name]);
      setLastAdded({ name: card.name, zone });
    },
    [choices, db.fresh, db.results, onAdd, setHighlight],
  );

  const keys = {
    main: useResolvedBinding('deck.addSearchResult'),
    side: useResolvedBinding('deck.addSearchResultToSideboard'),
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isImeComposition(event.nativeEvent)) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(moveHighlight(highlight, event.key === 'ArrowDown' ? 1 : -1, db.results.length));
      return;
    }
    if (highlight < 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' && !event.ctrlKey && !event.metaKey) {
      return;
    }
    const zone = dockKeyZone(event.nativeEvent, keys);
    if (zone) {
      event.preventDefault();
      add(highlight, zone);
    }
  };

  const gameChangerList = useGameChangerList(isCommanderFormat(format));
  const gameChanger = useMemo(
    () => gameChangerNote({ cardName: selectedName, gameChangers: gameChangerList, deckCards, format }),
    [deckCards, format, gameChangerList, selectedName],
  );

  const chosenPrinting = printingName ? choices[printingName] : undefined;
  const choosePrinting = useCallback(
    (scryfallId: string | undefined) => {
      if (!printingName) {
        return;
      }
      setChoices((prev) => {
        const next = { ...prev };
        if (scryfallId) {
          next[printingName] = scryfallId;
        } else {
          delete next[printingName];
        }
        return next;
      });
    },
    [printingName],
  );

  return {
    text,
    setText,
    filters,
    setFilters,
    composedQuery,
    results: db.results,
    total: db.total,
    stale: !db.fresh,
    loading: db.loading,
    loadingMore: db.loadingMore,
    error: db.error,
    hasMore: db.hasMore,
    loadMore: db.loadMore,
    highlight,
    setHighlight,
    selected,
    quantities,
    add,
    lastAdded,
    onKeyDown,
    view,
    setView,
    printings,
    printingsLoading,
    printingPrices,
    printingName,
    chosenPrinting,
    printingChoices: choices,
    choosePrinting,
    gameChanger,
    keys,
  };
}
