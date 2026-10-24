import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { HoverZoom, PreviewAnchor } from '../CardPreviewContext';
import { floatingPreviewLayout, type FloatingPreviewLayout, type PreviewChrome, type Viewport } from './previewLayout';

export const HOVER_ZOOM_DELAY_MS = 400;
export const HOVER_ZOOM_GRACE_MS = 300;
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

let viewportSnapshot: Viewport = { width: 0, height: 0 };

function readViewport(): Viewport {
  if (typeof window === 'undefined') {
    return viewportSnapshot;
  }
  if (viewportSnapshot.width !== window.innerWidth || viewportSnapshot.height !== window.innerHeight) {
    viewportSnapshot = { width: window.innerWidth, height: window.innerHeight };
  }
  return viewportSnapshot;
}

function subscribeViewport(onChange: () => void): () => void {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribeViewport, readViewport, readViewport);
}

export function useFloatingPreviewLayout(anchor: PreviewAnchor | null, chrome: PreviewChrome): FloatingPreviewLayout {
  const viewport = useViewport();
  const { x, y, textWidth } = chrome;
  return useMemo(() => floatingPreviewLayout(anchor, viewport, { x, y, textWidth }), [anchor, viewport, x, y, textWidth]);
}

function matchesFinePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(FINE_POINTER_QUERY).matches;
}

function subscribeFinePointer(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const list = window.matchMedia(FINE_POINTER_QUERY);
  list.addEventListener('change', onChange);
  return () => list.removeEventListener('change', onChange);
}

function useFinePointer(): boolean {
  return useSyncExternalStore(subscribeFinePointer, matchesFinePointer, () => false);
}

export function useHoverZoomTarget(zoom: HoverZoom | null): HoverZoom | null {
  const finePointer = useFinePointer();
  const [shown, setShown] = useState<HoverZoom | null>(null);
  const [dismissed, setDismissed] = useState<HoverZoom | null>(null);
  const [pressed, setPressed] = useState(false);
  const visible = useRef(false);
  const hiddenAt = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', up);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      window.removeEventListener('blur', up);
    };
  }, []);

  useEffect(() => {
    if (!zoom) {
      return;
    }
    const dismiss = () => setDismissed(zoom);
    window.addEventListener('pointerdown', dismiss, true);
    window.addEventListener('wheel', dismiss, { capture: true, passive: true });
    window.addEventListener('keydown', dismiss, true);
    return () => {
      window.removeEventListener('pointerdown', dismiss, true);
      window.removeEventListener('wheel', dismiss, { capture: true });
      window.removeEventListener('keydown', dismiss, true);
    };
  }, [zoom]);

  const active = finePointer && !pressed && zoom != null && zoom !== dismissed ? zoom : null;

  useEffect(() => {
    if (!active) {
      if (visible.current) {
        visible.current = false;
        hiddenAt.current = performance.now();
      }
      setShown(null);
      return;
    }
    const show = () => {
      visible.current = true;
      setShown(active);
    };
    if (visible.current || performance.now() - hiddenAt.current < HOVER_ZOOM_GRACE_MS) {
      show();
      return;
    }
    const timer = setTimeout(show, HOVER_ZOOM_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);

  return shown;
}
