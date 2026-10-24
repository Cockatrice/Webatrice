import { useCallback, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { isContextMenuKey } from '@app/components';
import { matchesEvent, useResolvedBinding } from '@app/feature-widgets/shortcuts';
import { tabbableElements, useGridRows, type ListOrientation } from '@app/hooks';

import { makeCardKey, useCardRegistry } from '../../../utils/CardRegistry/CardRegistryContext';
import { anchorOf, useCardPreviewActions, type PreviewCard } from '../CardPreviewContext';

export interface CardFocusOptions<C extends { id: string }> {
  zone: string;
  cards: readonly C[];
  orientation: ListOrientation;
  lines?: readonly (readonly string[])[];
  ownerOf: (card: C) => number;
  labelOf: (card: C) => string;
  previewOf: (card: C) => PreviewCard | null;
  selectedIds: ReadonlySet<string>;
  onSelectIds: (ids: Set<string>) => void;
  onActivate?: (card: C, element: HTMLElement) => void;
  onMove?: (card: C) => void;
  onOpenMenu: (card: C, rect: DOMRect) => void;
  onKeyboardFocus?: (focused: boolean) => void;
}

export interface CardFocusProps {
  ref: (element: HTMLElement | null) => void;
  tabIndex: number;
  role: 'option';
  'aria-selected': boolean;
  'aria-label': string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
  onPointerDownCapture: () => void;
}

export const ZOOM_KEY = 'z';

export function focusPastZone(from: HTMLElement, backwards: boolean): void {
  tabStopPast(from, backwards)?.focus();
}

function tabStopPast(from: HTMLElement, backwards: boolean): HTMLElement | undefined {
  const stops = tabbableElements(document.body);
  const index = stops.indexOf(from);
  return backwards ? stops[index - 1] ?? stops[stops.length - 1] : stops[index + 1] ?? stops[0];
}

export function cardFocusFallback(opener: HTMLElement): HTMLElement | null {
  const zone = opener.closest('[role="listbox"]');
  if (zone) {
    const options = [...zone.querySelectorAll<HTMLElement>('[role="option"]')];
    const index = options.indexOf(opener);
    const stays = (option: HTMLElement) => option !== opener && option.getAttribute('aria-selected') !== 'true';
    const near = options.slice(index + 1).find(stays) ?? options.slice(0, Math.max(index, 0)).reverse().find(stays);
    if (near) {
      return near;
    }
  }
  return tabStopPast(opener, false) ?? null;
}

export function useCardFocus<C extends { id: string }>({
  zone,
  cards,
  orientation,
  lines,
  ownerOf,
  labelOf,
  previewOf,
  selectedIds,
  onSelectIds,
  onActivate,
  onMove,
  onOpenMenu,
  onKeyboardFocus,
}: CardFocusOptions<C>) {
  const { setFocusedCard, openBigPreview, closeBigPreview } = useCardPreviewActions();
  const registry = useCardRegistry();
  const moveSequences = useResolvedBinding('game.moveCardDialog');
  const keys = lines ? lines.flat() : cards.map((card) => card.id);
  const byId = new Map(cards.map((card) => [card.id, card] as const));
  const [current, setCurrent] = useState<string | null>(null);
  const tabStop = current != null && byId.has(current)
    ? current
    : keys.find((key) => selectedIds.has(key)) ?? null;
  const anchor = useRef<string | null>(null);
  const pointerFocus = useRef(false);
  const zooming = useRef(false);
  const elements = useRef(new Map<string, HTMLElement>());

  const select = useCallback((key: string) => {
    anchor.current = key;
    onSelectIds(new Set([key]));
  }, [onSelectIds]);

  const toggle = useCallback((key: string) => {
    anchor.current = key;
    const next = new Set(selectedIds);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectIds(next);
  }, [selectedIds, onSelectIds]);

  const extend = useCallback((key: string) => {
    const from = keys.indexOf(anchor.current ?? current ?? key);
    const to = keys.indexOf(key);
    const [lo, hi] = from < 0 ? [to, to] : [Math.min(from, to), Math.max(from, to)];
    onSelectIds(new Set(keys.slice(lo, hi + 1)));
  }, [keys, current, onSelectIds]);

  const rows = useGridRows({
    keys,
    selectedKey: tabStop,
    onSelect: select,
    onActivate: (key) => {
      const card = byId.get(key);
      const element = elements.current.get(key);
      if (card && element) {
        onActivate?.(card, element);
      }
    },
    orientation,
    lines,
    onExtend: extend,
    focusOnlyWithCtrl: true,
    keepFocusOnRemoval: (removed) => tabStopPast(removed, false),
  });

  const endZoom = () => {
    if (zooming.current) {
      zooming.current = false;
      closeBigPreview();
    }
  };

  const cardProps = (card: C): CardFocusProps => {
    const row = rows.getRowProps(card.id);
    const registryKey = makeCardKey(ownerOf(card), zone, Number(card.id));
    return {
      ref: (element) => {
        row.ref(element);
        if (element) {
          elements.current.set(card.id, element);
          registry?.register(registryKey, element);
        } else {
          elements.current.delete(card.id);
          registry?.unregister(registryKey);
        }
      },
      tabIndex: row.tabIndex,
      role: 'option',
      'aria-selected': selectedIds.has(card.id),
      'aria-label': labelOf(card),
      onKeyDown: (event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (isContextMenuKey(event)) {
          event.preventDefault();
          event.stopPropagation();
          onOpenMenu(card, event.currentTarget.getBoundingClientRect());
          return;
        }
        if (event.key === 'F6' && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault();
          focusPastZone(event.currentTarget, event.shiftKey);
          return;
        }
        if (event.key.toLowerCase() === ZOOM_KEY && !event.ctrlKey && !event.altKey && !event.metaKey) {
          const preview = previewOf(card);
          if (preview && !event.repeat) {
            zooming.current = true;
            openBigPreview(preview, anchorOf(event.currentTarget));
          }
          event.preventDefault();
          return;
        }
        if (event.key === 'Enter' && event.shiftKey) {
          return;
        }
        if (onMove && moveSequences.some((sequence) => matchesEvent(sequence, event.nativeEvent))) {
          event.preventDefault();
          onMove(card);
          return;
        }
        if (event.key === ' ' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          toggle(card.id);
          return;
        }
        row.onKeyDown(event);
      },
      onKeyUp: (event) => {
        if (event.key.toLowerCase() === ZOOM_KEY) {
          endZoom();
        }
      },
      onFocus: (event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        setCurrent(card.id);
        if (pointerFocus.current) {
          pointerFocus.current = false;
          return;
        }
        setFocusedCard(previewOf(card));
        onKeyboardFocus?.(true);
      },
      onBlur: (event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        endZoom();
        setFocusedCard(null);
        onKeyboardFocus?.(false);
      },
      onPointerDownCapture: () => {
        pointerFocus.current = true;
        window.setTimeout(() => {
          pointerFocus.current = false;
        }, 0);
      },
    };
  };

  return { cardProps };
}
