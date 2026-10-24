import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

import { dispatchChatDock, type DockedChat } from '@app/hooks';

import { focusAfterClose, type DockFocusTarget } from './splitDock';

export interface DockFocusController {
  rootRef: RefObject<HTMLDivElement | null>;
  registerInput: (name: string, el: HTMLInputElement | null) => void;
  registerBar: (name: string, el: HTMLButtonElement | null) => void;
  minimise: (name: string) => void;
  close: (name: string) => void;
}

export function useDockFocus(
  windows: readonly DockedChat[],
  bars: readonly DockedChat[],
  focus: { name: string; seq: number } | null,
): DockFocusController {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const barButtons = useRef(new Map<string, HTMLButtonElement>());
  const opener = useRef<HTMLElement | null>(null);
  const pending = useRef<DockFocusTarget | null>(null);

  useLayoutEffect(() => {
    const active = document.activeElement;
    if (focus && active instanceof HTMLElement && active !== document.body && !rootRef.current?.contains(active)) {
      opener.current = active;
    }
  }, [focus]);

  useLayoutEffect(() => {
    const target = pending.current;
    if (!target) {
      return;
    }
    pending.current = null;
    if (target === 'opener') {
      if (opener.current?.isConnected) {
        opener.current.focus();
      }
      return;
    }
    (target.kind === 'bar' ? barButtons : inputs).current.get(target.name)?.focus();
  });

  const registerInput = useCallback((name: string, el: HTMLInputElement | null) => {
    if (el) {
      inputs.current.set(name, el);
    } else {
      inputs.current.delete(name);
    }
  }, []);
  const registerBar = useCallback((name: string, el: HTMLButtonElement | null) => {
    if (el) {
      barButtons.current.set(name, el);
    } else {
      barButtons.current.delete(name);
    }
  }, []);
  const minimise = useCallback((name: string) => {
    pending.current = { kind: 'bar', name };
    dispatchChatDock({ type: 'minimise', name });
  }, []);
  const close = useCallback((name: string) => {
    pending.current = focusAfterClose(windows, bars, name);
    dispatchChatDock({ type: 'close', name });
  }, [windows, bars]);

  return { rootRef, registerInput, registerBar, minimise, close };
}
