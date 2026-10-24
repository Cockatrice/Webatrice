import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface PanelPoint {
  x: number;
  y: number;
}

export interface PanelSize {
  w: number;
  h: number;
}

const HEADER_VISIBLE_PX = 60;

const STORE_DELAY_MS = 500;

function readStored<K extends string>(key: string, fields: readonly K[]): Record<K, number> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed && fields.every((f) => typeof parsed[f] === 'number' && Number.isFinite(parsed[f]))) {
      return Object.fromEntries(fields.map((f) => [f, parsed[f]])) as Record<K, number>;
    }
  } catch {
    // Unreadable: the panel opens at its default geometry.
  }
  return null;
}

function writeStored(key: string, value: PanelPoint | PanelSize): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage disabled or full: the geometry holds for this panel only.
  }
}

export function readStoredPosition(storageKey: string): PanelPoint | null {
  return readStored(`${storageKey}Position`, ['x', 'y']);
}

export function readStoredSize(storageKey: string): PanelSize | null {
  return readStored(`${storageKey}Size`, ['w', 'h']);
}

export function clampPanelSize(size: PanelSize, min: PanelSize): PanelSize {
  return {
    w: Math.min(Math.max(min.w, size.w), window.innerWidth),
    h: Math.min(Math.max(min.h, size.h), window.innerHeight),
  };
}

export function clampPanelPosition(pos: PanelPoint, size: PanelSize): PanelPoint {
  return {
    x: Math.max(HEADER_VISIBLE_PX - size.w, Math.min(window.innerWidth - HEADER_VISIBLE_PX, pos.x)),
    y: Math.max(0, Math.min(window.innerHeight - HEADER_VISIBLE_PX, pos.y)),
  };
}

export interface FloatingPanelGeometryOptions {
  storageKey: string;
  minSize: PanelSize;
  initialSize: PanelSize | ((panel: HTMLDivElement) => void);
  openKey?: unknown;
}

export function useFloatingPanelGeometry({ storageKey, minSize, initialSize, openKey }: FloatingPanelGeometryOptions) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<PanelPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<PanelPoint | null>(null);
  const hasBeenDragged = useRef(false);
  const initialSizeRef = useRef(initialSize);
  initialSizeRef.current = initialSize;

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) {
      return;
    }
    const stored = readStoredSize(storageKey);
    const initial = initialSizeRef.current;
    if (stored) {
      const { w, h } = clampPanelSize(stored, minSize);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    } else if (typeof initial === 'function') {
      initial(el);
    } else {
      el.style.width = `${initial.w}px`;
      el.style.height = `${initial.h}px`;
    }
    // minSize is a constant per panel; openKey re-opens it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, openKey]);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) {
      return;
    }
    hasBeenDragged.current = false;
    const rect = el.getBoundingClientRect();
    const stored = readStoredPosition(storageKey);
    setPos(stored
      ? clampPanelPosition(stored, { w: rect.width, h: rect.height })
      : {
        x: Math.max(0, (window.innerWidth - rect.width) / 2),
        y: Math.max(0, (window.innerHeight - rect.height) / 2),
      });
  }, [storageKey, openKey]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) {
      return;
    }
    let first = true;
    let timer: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      if (first) {
        first = false;
        return;
      }
      const { width: w, height: h } = entry.contentRect;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => writeStored(`${storageKey}Size`, { w, h }), STORE_DELAY_MS);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [storageKey, openKey]);

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const onMove = (e: PointerEvent) => {
      const off = dragOffset.current;
      if (off) {
        setPos({ x: e.clientX - off.x, y: e.clientY - off.y });
      }
    };
    const onUp = () => {
      dragOffset.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  useEffect(() => {
    if (!pos || !hasBeenDragged.current) {
      return;
    }
    const timer = window.setTimeout(() => writeStored(`${storageKey}Position`, pos), STORE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [storageKey, pos]);

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement | null)?.closest('button')) {
      return;
    }
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPos({ x: rect.left, y: rect.top });
    setDragging(true);
    hasBeenDragged.current = true;
  };

  const panelStyle: CSSProperties = {
    minWidth: `min(${minSize.w}px, 100vw)`,
    minHeight: `min(${minSize.h}px, 100vh)`,
    ...(pos ? { position: 'absolute', left: pos.x, top: pos.y, margin: 0 } : null),
  };

  return { panelRef, panelStyle, dragging, onHeaderPointerDown };
}
