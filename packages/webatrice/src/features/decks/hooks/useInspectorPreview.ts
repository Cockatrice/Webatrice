import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolvePreviewTarget, type InspectedCard, type PreviewTarget } from '../components/editor/editorSelection';
import type { DeckCard } from '../types';

export const PREVIEW_LEAVE_DELAY_MS = 80;

export interface InspectorPreview extends PreviewTarget {
  hovered: InspectedCard | null;
  enter: (card: InspectedCard) => void;
  leave: () => void;
  clear: () => void;
}

export function useInspectorPreview(
  cards: readonly DeckCard[],
  selected: InspectedCard | null,
  leaveDelayMs = PREVIEW_LEAVE_DELAY_MS,
): InspectorPreview {
  const [hovered, setHovered] = useState<InspectedCard | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const enter = useCallback((card: InspectedCard) => {
    cancel();
    setHovered(card);
  }, [cancel]);
  const leave = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      setHovered(null);
    }, leaveDelayMs);
  }, [cancel, leaveDelayMs]);
  const clear = useCallback(() => {
    cancel();
    setHovered(null);
  }, [cancel]);
  useEffect(() => cancel, [cancel]);

  const target = useMemo(() => resolvePreviewTarget(cards, hovered, selected), [cards, hovered, selected]);
  return { ...target, hovered, enter, leave, clear };
}
