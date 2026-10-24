import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

import { listArrows, navigationTarget, type ListOrientation } from './gridNavigation';

export interface GridRowsOptions {
  keys: readonly string[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onActivate: (key: string) => void;
  onExpand?: (key: string) => void;
  onCollapse?: (key: string) => void;
  orientation?: ListOrientation;
  lines?: readonly (readonly string[])[];
  onExtend?: (key: string) => void;
  keepFocusOnRemoval?: boolean | ((removed: HTMLElement) => HTMLElement | null | undefined);
  focusOnlyWithCtrl?: boolean;
}

export interface RenderedRows {
  startIndex: number;
  stopIndex: number;
}

export interface GridRowProps {
  ref: (element: HTMLElement | null) => void;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function locate(lines: readonly (readonly string[])[], key: string): { line: number; at: number } | null {
  for (let line = 0; line < lines.length; line++) {
    const at = lines[line].indexOf(key);
    if (at >= 0) {
      return { line, at };
    }
  }
  return null;
}

function lineTarget(
  lines: readonly (readonly string[])[],
  key: string,
  pressed: string,
  orientation: ListOrientation,
): string | null {
  const from = locate(lines, key);
  if (!from) {
    return null;
  }
  const line = lines[from.line];
  const along = navigationTarget(pressed, from.at, line.length, orientation);
  if (along !== null) {
    return line[along];
  }
  const across = listArrows(orientation === 'vertical' ? 'horizontal' : 'vertical');
  const step = pressed === across.next ? 1 : pressed === across.previous ? -1 : 0;
  if (step === 0) {
    return null;
  }
  for (let next = from.line + step; next >= 0 && next < lines.length; next += step) {
    if (lines[next].length > 0) {
      return lines[next][Math.min(from.at, lines[next].length - 1)];
    }
  }
  return key;
}

export function useGridRows({
  keys,
  selectedKey,
  onSelect,
  onActivate,
  onExpand,
  onCollapse,
  orientation = 'vertical',
  lines,
  onExtend,
  keepFocusOnRemoval = false,
  focusOnlyWithCtrl = false,
}: GridRowsOptions) {
  const elements = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [rendered, setRendered] = useState<{ visibleStart: number; start: number; stop: number } | null>(null);
  const onRowsRendered = useCallback((visibleRows: RenderedRows, allRows: RenderedRows) => {
    setRendered((prev) =>
      prev?.visibleStart === visibleRows.startIndex && prev.start === allRows.startIndex && prev.stop === allRows.stopIndex
        ? prev
        : { visibleStart: visibleRows.startIndex, start: allRows.startIndex, stop: allRows.stopIndex });
  }, []);
  const preferred = selectedKey != null && keys.includes(selectedKey) ? selectedKey : keys[0] ?? null;
  const preferredIndex = preferred != null ? keys.indexOf(preferred) : -1;
  const preferredUnrendered = rendered != null && (preferredIndex < rendered.start || preferredIndex > rendered.stop);
  const tabStop = preferredUnrendered ? keys[rendered.visibleStart] ?? preferred : preferred;

  useEffect(() => {
    const key = pendingFocus.current;
    const element = key != null ? elements.current.get(key) : undefined;
    if (element) {
      pendingFocus.current = null;
      element.focus();
    }
    if (key != null && !element) {
      if (keys.includes(key)) {
        onSelect(key);
      } else {
        pendingFocus.current = null;
      }
    }
  }, [focusRequest, keys, onSelect]);

  const requestFocus = useCallback((key: string) => {
    pendingFocus.current = key;
    setFocusRequest((n) => n + 1);
  }, []);

  const detachedFocus = useRef<{ key: string; element: HTMLElement; successors: readonly string[] } | null>(null);
  useLayoutEffect(() => {
    const detached = detachedFocus.current;
    detachedFocus.current = null;
    if (detached && !detached.element.isConnected && !keys.includes(detached.key)) {
      const successor = detached.successors.find((k) => elements.current.has(k));
      if (successor != null) {
        requestFocus(successor);
      }
    }
  });

  const moveTo = useCallback((key: string | undefined) => {
    if (key != null) {
      onSelect(key);
      requestFocus(key);
    }
  }, [onSelect, requestFocus]);

  const getRowProps = useCallback((key: string): GridRowProps => ({
    ref: (element) => {
      if (element) {
        elements.current.set(key, element);
        if (pendingFocus.current === key) {
          pendingFocus.current = null;
          element.focus();
        }
        return;
      }
      const removed = elements.current.get(key);
      elements.current.delete(key);
      if (removed == null || removed !== document.activeElement) {
        return;
      }
      if (pendingFocus.current == null) {
        pendingFocus.current = key;
      }
      if (keepFocusOnRemoval) {
        const index = keys.indexOf(key);
        detachedFocus.current = {
          key,
          element: removed,
          successors: [...keys.slice(index + 1), ...keys.slice(0, index).reverse()],
        };
        const fallback = typeof keepFocusOnRemoval === 'function' ? keepFocusOnRemoval(removed) : null;
        if (fallback) {
          queueMicrotask(() => {
            const active = document.activeElement;
            if (!removed.isConnected && (active == null || active === document.body) && fallback.isConnected) {
              fallback.focus();
            }
          });
        }
      }
    },
    tabIndex: key === tabStop ? 0 : -1,
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget || event.altKey) {
        return;
      }
      const focusOnly = focusOnlyWithCtrl && (event.ctrlKey || event.metaKey) && !event.shiftKey;
      if ((event.ctrlKey || event.metaKey) && !focusOnly) {
        return;
      }
      const index = keys.indexOf(key);
      const targetKey = lines
        ? lineTarget(lines, key, event.key, orientation)
        : (() => {
          const target = navigationTarget(event.key, index < 0 ? null : index, keys.length, orientation);
          return target === null ? null : keys[target];
        })();
      if (focusOnly) {
        if (targetKey != null) {
          event.preventDefault();
          if (targetKey !== key) {
            requestFocus(targetKey);
          }
        }
        return;
      }
      if (targetKey != null) {
        const extend = event.shiftKey && onExtend != null;
        if (targetKey !== key || event.key === 'Home' || event.key === 'End') {
          if (extend) {
            onExtend(targetKey);
            requestFocus(targetKey);
          } else {
            moveTo(targetKey);
          }
        }
        event.preventDefault();
        return;
      }
      const tree = !lines && orientation === 'vertical';
      switch (event.key) {
        case ' ':
          onSelect(key);
          break;
        case 'Enter':
          onActivate(key);
          break;
        case 'ArrowRight':
          if (!tree || !onExpand) {
            return;
          }
          onExpand(key);
          break;
        case 'ArrowLeft':
          if (!tree || !onCollapse) {
            return;
          }
          onCollapse(key);
          break;
        default:
          return;
      }
      event.preventDefault();
    },
  }), [
    keys, tabStop, lines, orientation, keepFocusOnRemoval, focusOnlyWithCtrl,
    moveTo, requestFocus, onSelect, onExtend, onActivate, onExpand, onCollapse,
  ]);

  return { getRowProps, focusRow: moveTo, onRowsRendered };
}
