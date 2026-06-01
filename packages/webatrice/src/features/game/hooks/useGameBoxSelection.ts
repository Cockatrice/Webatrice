import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';

import { makeCardKey } from '../utils/CardRegistry/CardRegistryContext';
import { EMPTY_SELECTION } from '../utils/selection';

const BOX_DRAG_THRESHOLD_PX = 4;

interface BoxDragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  // Ctrl/Shift held at drag-start: union onto priorKeys instead of replacing.
  additive: boolean;
  // The [data-zone-box-select] surface the drag started in. The hit-test is
  // scoped to this element's cards, which both (a) lets dialog drags work and
  // (b) stops a battlefield drag from selecting cards inside an open dialog.
  originZoneEl: Element;
  priorKeys: ReadonlySet<string>;
  moved: boolean;
}

// Viewport-relative band rect (NOT board-relative) — a drag may originate inside
// a position:fixed dialog, so the overlay is positioned against the viewport.
export interface BoxSelectPreview {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GameBoxSelection {
  handleGameMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  previewRect: BoxSelectPreview | null;
}

export interface UseGameBoxSelectionArgs {
  selectedCardKeys: ReadonlySet<string>;
  setSelectedCardKeys: Dispatch<SetStateAction<ReadonlySet<string>>>;
  clearSelection: () => void;
  clearFocused: () => void;
  // True while an arrow/attach is pending — box-select yields the pointer.
  pendingActive: boolean;
}

function rectsIntersect(
  band: { left: number; top: number; right: number; bottom: number },
  el: DOMRect,
): boolean {
  return (
    el.left < band.right &&
    el.right > band.left &&
    el.top < band.bottom &&
    el.bottom > band.top
  );
}

function keysInBand(drag: BoxDragState, x: number, y: number): Set<string> {
  const band = {
    left: Math.min(drag.startX, x),
    top: Math.min(drag.startY, y),
    right: Math.max(drag.startX, x),
    bottom: Math.max(drag.startY, y),
  };
  const keys = new Set(drag.priorKeys);
  drag.originZoneEl.querySelectorAll('[data-card-id]').forEach((el) => {
    if (!rectsIntersect(band, el.getBoundingClientRect())) {
      return;
    }
    const ownerId = Number(el.getAttribute('data-card-owner'));
    const zone = el.getAttribute('data-card-zone') ?? '';
    const cardId = Number(el.getAttribute('data-card-id'));
    if (Number.isFinite(ownerId) && zone && Number.isFinite(cardId)) {
      keys.add(makeCardKey(ownerId, zone, cardId));
    }
  });
  return keys;
}

export function useGameBoxSelection({
  selectedCardKeys,
  setSelectedCardKeys,
  clearSelection,
  clearFocused,
  pendingActive,
}: UseGameBoxSelectionArgs): GameBoxSelection {
  // dragRef is authoritative for the move handler; drag state drives previewRect.
  const dragRef = useRef<BoxDragState | null>(null);
  const [drag, setDrag] = useState<BoxDragState | null>(null);

  const selectedCardKeysRef = useRef(selectedCardKeys);
  selectedCardKeysRef.current = selectedCardKeys;
  const pendingActiveRef = useRef(pendingActive);
  pendingActiveRef.current = pendingActive;

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  // ESC clears unless a MUI dialog owns the key (its own close handler wins).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('.MuiDialog-root[role="dialog"]')) {
        return;
      }
      endDrag();
      clearSelection();
      clearFocused();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [endDrag, clearSelection, clearFocused]);

  const dragActive = drag !== null;
  useEffect(() => {
    if (!dragActive) {
      return undefined;
    }
    const handleMove = (e: MouseEvent) => {
      const prev = dragRef.current;
      if (!prev) {
        return;
      }
      const moved = prev.moved || Math.abs(e.clientX - prev.startX) + Math.abs(e.clientY - prev.startY) > BOX_DRAG_THRESHOLD_PX;
      const next = { ...prev, currentX: e.clientX, currentY: e.clientY, moved };
      dragRef.current = next;
      setDrag(next);
      if (moved) {
        setSelectedCardKeys(keysInBand(prev, e.clientX, e.clientY));
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', endDrag);
    };
  }, [dragActive, setSelectedCardKeys, endDrag]);

  const handleGameMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || pendingActiveRef.current) {
        return;
      }
      const target = e.target as HTMLElement;
      // A mousedown on a card is a click/drag of that card, not a box-select.
      if (target.closest('[data-card-id]')) {
        return;
      }
      const originZoneEl = target.closest('[data-zone-box-select]');
      if (!originZoneEl) {
        return;
      }
      const additive = e.ctrlKey || e.shiftKey;
      // Non-additive: clear at drag-start. A plain click that never crosses the
      // threshold therefore clears the selection (falls out of this).
      if (!additive) {
        clearSelection();
        clearFocused();
      }
      const next: BoxDragState = {
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        additive,
        originZoneEl,
        priorKeys: additive ? selectedCardKeysRef.current : EMPTY_SELECTION,
        moved: false,
      };
      dragRef.current = next;
      setDrag(next);
    },
    [clearSelection, clearFocused],
  );

  const previewRect: BoxSelectPreview | null =
    drag && drag.moved
      ? {
        left: Math.min(drag.startX, drag.currentX),
        top: Math.min(drag.startY, drag.currentY),
        width: Math.abs(drag.currentX - drag.startX),
        height: Math.abs(drag.currentY - drag.startY),
      }
      : null;

  return { handleGameMouseDown, previewRect };
}
