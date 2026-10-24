import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '@app/utils';

export type PopoverAnchor = RefObject<HTMLElement | null> | HTMLElement | (() => HTMLElement | null) | null;

export interface AnchoredPopoverProps {
  anchor: PopoverAnchor;
  fallback?: HTMLElement | null;
  focusFallback?: HTMLElement | null;
  layoutKey?: unknown;
  label: string;
  onClose: () => void;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

interface Placement {
  top: number;
  left: number;
  maxHeight: number;
}

const GAP = 8;
const MARGIN = 8;
const MIN_HEIGHT = 160;
const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

export function resolveAnchor(anchor: PopoverAnchor): HTMLElement | null {
  if (!anchor) {
    return null;
  }
  if (typeof anchor === 'function') {
    return anchor();
  }
  const element = 'current' in anchor ? anchor.current : anchor;
  return element?.isConnected ? element : null;
}

export function placePopover(
  rect: Pick<DOMRect, 'top' | 'bottom' | 'left' | 'right'>,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  align: 'start' | 'end',
): Placement {
  const preferredLeft = align === 'end' ? rect.right - size.width : rect.left;
  const left = Math.max(MARGIN, Math.min(preferredLeft, viewport.width - size.width - MARGIN));
  const below = viewport.height - MARGIN - (rect.bottom + GAP);
  const above = rect.top - GAP - MARGIN;
  if (size.height <= below || below >= above || below >= MIN_HEIGHT) {
    const top = Math.max(MARGIN, Math.min(rect.bottom + GAP, viewport.height - MARGIN - MIN_HEIGHT));
    return { top, left, maxHeight: Math.max(MIN_HEIGHT, viewport.height - MARGIN - top) };
  }
  const maxHeight = Math.max(MIN_HEIGHT, above);
  const height = Math.min(size.height, maxHeight);
  return { top: Math.max(MARGIN, rect.top - GAP - height), left, maxHeight };
}

function focusTarget(
  anchor: HTMLElement | null,
  fallback: HTMLElement | null | undefined,
  focusFallback: HTMLElement | null | undefined,
): HTMLElement | null {
  if (anchor && !(anchor as HTMLButtonElement).disabled) {
    return anchor;
  }
  const row = anchor?.closest<HTMLElement>('[tabindex]');
  if (row) {
    return row;
  }
  if (focusFallback?.isConnected) {
    return focusFallback;
  }
  return fallback?.matches(FOCUSABLE) ? fallback : fallback?.querySelector<HTMLElement>(FOCUSABLE) ?? null;
}

export function AnchoredPopover({
  anchor,
  fallback,
  focusFallback,
  layoutKey,
  label,
  onClose,
  align = 'start',
  className,
  children,
}: AnchoredPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const latest = useRef({ onClose, anchor, fallback, focusFallback });
  const restoreFocus = useRef(true);
  useEffect(() => {
    latest.current = { onClose, anchor, fallback, focusFallback };
  });

  useLayoutEffect(() => {
    const place = () => {
      const target = resolveAnchor(anchor) ?? fallback ?? null;
      const panel = ref.current;
      if (!target || !panel) {
        latest.current.onClose();
        return;
      }
      const next = placePopover(
        target.getBoundingClientRect(),
        { width: panel.offsetWidth, height: panel.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight },
        align,
      );
      setPlacement((prev) => (prev && prev.top === next.top && prev.left === next.left && prev.maxHeight === next.maxHeight
        ? prev
        : next));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, fallback, align, layoutKey]);

  useEffect(() => {
    const panel = ref.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || resolveAnchor(latest.current.anchor)?.contains(target)) {
        return;
      }
      restoreFocus.current = false;
      latest.current.onClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  useLayoutEffect(() => {
    const panel = ref.current;
    return () => {
      const active = document.activeElement;
      if (!restoreFocus.current || (active && active !== document.body && !panel?.contains(active))) {
        return;
      }
      const { anchor: lastAnchor, fallback: lastFallback, focusFallback: lastFocusFallback } = latest.current;
      focusTarget(resolveAnchor(lastAnchor), lastFallback, lastFocusFallback)?.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          onClose();
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !ref.current?.contains(next) && !resolveAnchor(anchor)?.contains(next)) {
          restoreFocus.current = false;
          onClose();
        }
      }}
      style={{
        top: placement?.top ?? 0,
        left: placement?.left ?? 0,
        maxHeight: placement?.maxHeight,
        visibility: placement ? 'visible' : 'hidden',
      }}
      className={cx(
        'fixed z-50 overflow-y-auto overscroll-contain rounded-ui-lg border border-border-subtle bg-bg-surface p-3',
        'text-text-primary shadow-pop',
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
