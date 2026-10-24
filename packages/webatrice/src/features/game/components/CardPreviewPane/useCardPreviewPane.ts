import { useCallback, useEffect, useState } from 'react';

import { ScryfallImageSize } from '@cockatrice/datatrice';
import { detailTargetKey, fetchScryfallDetail, getScryfallUrlByIdOrExactName, type ScryfallDetail } from '@app/services';

import { useCardInfoRequest, useCardPreview, type PreviewCard } from '../ui/CardPreviewContext';
import { useCardPreviewPopup } from '../CardPreviewPopup/useCardPreviewPopup';

export type PreviewMode = 'image' | 'text' | 'both';

const CARD_PREVIEW_MODE_STORAGE_KEY = 'webatrice.cardPreviewMode';
const CARD_PREVIEW_HIDDEN_STORAGE_KEY = 'webatrice.cardPreviewHidden';

function readPersistedHidden(): boolean {
  try {
    return window.localStorage.getItem(CARD_PREVIEW_HIDDEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistHidden(hidden: boolean): void {
  try {
    window.localStorage.setItem(CARD_PREVIEW_HIDDEN_STORAGE_KEY, hidden ? '1' : '0');
  } catch {
    return;
  }
}

function readPersistedPreviewMode(): PreviewMode {
  if (typeof window === 'undefined') {
    return 'image';
  }
  try {
    const raw = window.localStorage.getItem(CARD_PREVIEW_MODE_STORAGE_KEY);
    return raw === 'text' || raw === 'both' ? raw : 'image';
  } catch {
    return 'image';
  }
}

type NamedCard = { name: string; scryfallId?: string };
type DetailFetchState = 'idle' | 'loading' | 'loaded' | 'not-found';

export interface PreviewText {
  name: string;
  mana: string;
  type: string;
  oracle: string;
  flavor: string;
  pt: string | undefined;
  loyalty: string | undefined;
}

export function previewTextOf(detail: ScryfallDetail | null, activeName: string | undefined): PreviewText {
  const face =
    detail?.card_faces?.find((f) => f.name?.toLowerCase() === activeName?.toLowerCase())
    ?? detail?.card_faces?.[0];
  const power = face?.power ?? detail?.power;
  const toughness = face?.toughness ?? detail?.toughness;
  return {
    name: face?.name ?? detail?.name ?? activeName ?? '',
    mana: face?.mana_cost ?? detail?.mana_cost ?? '',
    type: face?.type_line ?? detail?.type_line ?? '',
    oracle: face?.oracle_text ?? detail?.oracle_text ?? '',
    flavor: face?.flavor_text ?? detail?.flavor_text ?? '',
    pt: power != null && toughness != null ? `${power}/${toughness}` : undefined,
    loyalty: face?.loyalty ?? detail?.loyalty,
  };
}

export function useCardPreviewPane() {
  const hoveredCard = useCardPreview();
  const [mode, setMode] = useState<PreviewMode>(readPersistedPreviewMode);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(CARD_PREVIEW_MODE_STORAGE_KEY, mode);
    } catch {
      return;
    }
  }, [mode]);

  const [hidden, setHidden] = useState(readPersistedHidden);
  const toggleHidden = useCallback(() => {
    setHidden((was) => {
      persistHidden(!was);
      return !was;
    });
  }, []);

  const [overrideStack, setOverrideStack] = useState<NamedCard[]>([]);
  const override = overrideStack.length > 0 ? overrideStack[overrideStack.length - 1] : null;
  const hoveredKey = hoveredCard ? detailTargetKey(hoveredCard) : null;
  useEffect(() => {
    setOverrideStack([]);
  }, [hoveredKey]);

  const activeCard: NamedCard | null = override ?? (hoveredCard
    ? { name: hoveredCard.name, scryfallId: hoveredCard.scryfallId }
    : null);
  const previousInStack: NamedCard | null = overrideStack.length > 1
    ? overrideStack[overrideStack.length - 2]
    : overrideStack.length === 1 && hoveredCard
      ? { name: hoveredCard.name, scryfallId: hoveredCard.scryfallId }
      : null;

  const navigate = useCallback((next: NamedCard) => {
    setOverrideStack((stack) => [...stack, next]);
  }, []);
  const back = useCallback(() => {
    setOverrideStack((stack) => stack.slice(0, -1));
  }, []);
  useCardInfoRequest(useCallback(
    (card: PreviewCard) => navigate({ name: card.name, scryfallId: card.scryfallId }),
    [navigate],
  ));

  const [detail, setDetail] = useState<ScryfallDetail | null>(null);
  const [detailFetchState, setDetailFetchState] = useState<DetailFetchState>('idle');
  const activeKey = activeCard ? detailTargetKey(activeCard) : null;

  const popupPayload = activeCard
    ? { name: activeCard.name, scryfallId: activeCard.scryfallId, imageUri: !override ? hoveredCard?.imageUri : undefined }
    : null;
  const { isOpen: isPopupOpen, toggle: togglePopup } = useCardPreviewPopup(
    popupPayload,
    mode,
    detail,
    detailFetchState,
    navigate,
    previousInStack?.name,
    back,
  );

  useEffect(() => {
    const needsDetail = !hidden && (mode === 'text' || mode === 'both');
    if (!needsDetail || !activeCard) {
      setDetail(null);
      setDetailFetchState('idle');
      return;
    }
    setDetail(null);
    setDetailFetchState('loading');
    const controller = new AbortController();
    fetchScryfallDetail(activeCard.scryfallId, activeCard.name, controller.signal)
      .then((d) => {
        setDetail(d);
        setDetailFetchState(d ? 'loaded' : 'not-found');
      })
      .catch((e) => {
        if ((e as { name?: string })?.name === 'AbortError') {
          return;
        }
        setDetailFetchState('not-found');
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the card identity (`activeKey`) changes
  }, [mode, activeKey, hidden]);

  const imageUrl = activeCard
    ? (!override && hoveredCard?.imageUri)
      ? hoveredCard.imageUri
      : getScryfallUrlByIdOrExactName(activeCard, ScryfallImageSize.Png)
    : null;

  return {
    mode,
    setMode,
    hidden,
    toggleHidden,
    activeCard,
    override,
    hoveredCard,
    previousInStack,
    navigate,
    back,
    detail,
    detailFetchState,
    isPopupOpen,
    togglePopup,
    imageUrl,
    text: previewTextOf(detail, activeCard?.name),
  };
}
