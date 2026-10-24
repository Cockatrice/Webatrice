import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

export interface PreviewCard {
  name: string;
  scryfallId?: string;
  imageUri?: string;
  pt?: string;
  annotation?: string;
}

export interface PreviewAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface HoverZoom {
  card: PreviewCard;
  anchor: PreviewAnchor;
}

export function anchorOf(element: Element): PreviewAnchor {
  const { left, top, right, bottom } = element.getBoundingClientRect();
  return { left, top, right, bottom };
}

export interface CardPreviewActions {
  setHoveredCard: (card: PreviewCard | null, anchor?: PreviewAnchor) => void;
  endHover: () => void;
  setFocusedCard: (card: PreviewCard | null) => void;
  openBigPreview: (card: PreviewCard, anchor?: PreviewAnchor) => void;
  closeBigPreview: () => void;
  showCardInfo: (card: PreviewCard) => void;
}

export interface CardInfoRequest {
  card: PreviewCard;
}

export interface CardPreviewStore extends CardPreviewActions {
  subscribe: (listener: () => void) => () => void;
  getPreviewCard: () => PreviewCard | null;
  getBigPreviewCard: () => PreviewCard | null;
  getBigPreviewAnchor: () => PreviewAnchor | null;
  getHoverZoom: () => HoverZoom | null;
  getCardInfoRequest: () => CardInfoRequest | null;
  consumeCardInfoRequest: (request: CardInfoRequest) => void;
}

export function createCardPreviewStore(): CardPreviewStore {
  let hovered: PreviewCard | null = null;
  let focused: PreviewCard | null = null;
  let big: PreviewCard | null = null;
  let bigAnchor: PreviewAnchor | null = null;
  let hoverZoom: HoverZoom | null = null;
  let infoRequest: CardInfoRequest | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getPreviewCard: () => focused ?? hovered,
    getBigPreviewCard: () => big,
    getBigPreviewAnchor: () => bigAnchor,
    getHoverZoom: () => hoverZoom,
    getCardInfoRequest: () => infoRequest,
    setHoveredCard: (card, anchor) => {
      const zoom = card && anchor ? { card, anchor } : null;
      if (card !== hovered || zoom != null || hoverZoom != null) {
        hovered = card;
        hoverZoom = zoom;
        emit();
      }
    },
    endHover: () => {
      if (hoverZoom) {
        hoverZoom = null;
        emit();
      }
    },
    setFocusedCard: (card) => {
      if (card !== focused) {
        focused = card;
        emit();
      }
    },
    openBigPreview: (card, anchor) => {
      big = card;
      bigAnchor = anchor ?? null;
      emit();
    },
    closeBigPreview: () => {
      if (big) {
        big = null;
        bigAnchor = null;
        emit();
      }
    },
    showCardInfo: (card) => {
      infoRequest = { card };
      emit();
    },
    consumeCardInfoRequest: (request) => {
      if (infoRequest === request) {
        infoRequest = null;
        emit();
      }
    },
  };
}

const CardPreviewContext = createContext<CardPreviewStore | null>(null);

export function CardPreviewProvider({ store, children }: { store: CardPreviewStore; children: ReactNode }) {
  return <CardPreviewContext.Provider value={store}>{children}</CardPreviewContext.Provider>;
}

const NOOP_ACTIONS: CardPreviewActions = {
  setHoveredCard: () => {},
  endHover: () => {},
  setFocusedCard: () => {},
  openBigPreview: () => {},
  closeBigPreview: () => {},
  showCardInfo: () => {},
};

const noSubscription = () => () => {};
const noCard = () => null;

export function useCardPreviewActions(): CardPreviewActions {
  return useContext(CardPreviewContext) ?? NOOP_ACTIONS;
}

export function useCardPreview(): PreviewCard | null {
  const store = useContext(CardPreviewContext);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getPreviewCard ?? noCard);
}

export function useBigPreviewCard(): PreviewCard | null {
  const store = useContext(CardPreviewContext);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getBigPreviewCard ?? noCard);
}

export function useBigPreviewAnchor(): PreviewAnchor | null {
  const store = useContext(CardPreviewContext);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getBigPreviewAnchor ?? noCard);
}

export function useHoverZoom(): HoverZoom | null {
  const store = useContext(CardPreviewContext);
  return useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getHoverZoom ?? noCard);
}

export function useCardInfoRequest(onRequest: (card: PreviewCard) => void): void {
  const store = useContext(CardPreviewContext);
  const request = useSyncExternalStore(store?.subscribe ?? noSubscription, store?.getCardInfoRequest ?? noCard);
  useEffect(() => {
    if (request && store) {
      store.consumeCardInfoRequest(request);
      onRequest(request.card);
    }
  }, [request, store, onRequest]);
}
