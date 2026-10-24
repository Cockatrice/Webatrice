import { createContext, useCallback, useContext, useEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react';

import { registerModal } from './modalStack';

const TABBABLE = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
].join(',');

function isRendered(element: HTMLElement, container: HTMLElement): boolean {
  if (getComputedStyle(element).visibility === 'hidden') {
    return false;
  }
  for (let node: HTMLElement | null = element; node && node !== container; node = node.parentElement) {
    if (getComputedStyle(node).display === 'none') {
      return false;
    }
  }
  return true;
}

export function tabbableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE))
    .filter((element) => !element.closest('[hidden],[inert]') && isRendered(element, container));
  const radioStops = new Map<string, HTMLInputElement>();
  for (const element of candidates) {
    if (element instanceof HTMLInputElement && element.type === 'radio' && element.name) {
      const stop = radioStops.get(element.name);
      if (!stop || (element.checked && !stop.checked)) {
        radioStops.set(element.name, element);
      }
    }
  }
  return candidates.filter((element) => !(element instanceof HTMLInputElement && element.type === 'radio'
    && element.name && radioStops.get(element.name) !== element));
}

export type ReturnFocusTo = (opener: HTMLElement) => HTMLElement | null;

export const DialogReturnFocusContext = createContext<ReturnFocusTo | undefined>(undefined);

const LANDMARK = [
  'main', 'nav', 'aside', 'section[aria-label]', 'section[aria-labelledby]',
  '[role="main"]', '[role="navigation"]', '[role="complementary"]', '[role="region"]',
].join(',');

export const closestLandmark: ReturnFocusTo = (opener) =>
  opener.closest<HTMLElement>(LANDMARK) ?? document.querySelector<HTMLElement>('main');

export const closestList: ReturnFocusTo = (opener) =>
  opener.closest<HTMLElement>('[role="list"],[role="log"]') ?? closestLandmark(opener);

export function focusFallback(element: HTMLElement) {
  if (!element.hasAttribute('tabindex') && element.tabIndex < 0) {
    element.setAttribute('tabindex', '-1');
    element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
  }
  element.focus();
}

let handedOver: HTMLElement | null = null;

export interface DialogFocusOptions {
  isOpen: boolean;
  isolate?: boolean;
  onEscape?: () => void;
  returnFocusTo?: ReturnFocusTo;
  modal?: boolean;
  moveFocusIn?: boolean;
}

export interface DialogFocusProps {
  ref: (element: HTMLElement | null) => void;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
}

export function useDialogFocus({
  isOpen, onEscape, returnFocusTo, isolate = false, modal = true, moveFocusIn = true,
}: DialogFocusOptions) {
  const container = useRef<HTMLElement | null>(null);
  const focusedBefore = useRef<HTMLElement | null>(null);
  const returnFocusToRef = useRef(returnFocusTo);
  returnFocusToRef.current = returnFocusTo;
  const moveFocusInRef = useRef(moveFocusIn);
  moveFocusInRef.current = moveFocusIn;

  useEffect(() => {
    const element = container.current;
    if (!isOpen || !element) {
      return;
    }
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = (focusedBefore.current?.isConnected ? focusedBefore.current : null)
      ?? (active && active !== document.body && !element.contains(active) ? active : handedOver);
    handedOver = null;
    const fallback = opener ? (returnFocusToRef.current ?? closestLandmark)(opener) : null;
    const releaseModal = isolate ? registerModal(element) : undefined;
    if (moveFocusInRef.current && !element.contains(document.activeElement)) {
      const content = element.querySelector<HTMLElement>('[data-dialog-content]');
      const target = element.querySelector<HTMLElement>('[data-autofocus]')
        ?? (content && tabbableElements(content)[0])
        ?? tabbableElements(element)[0]
        ?? element;
      target.focus();
    }

    const rehome = () => {
      const current = document.activeElement;
      const dialogs = document.querySelectorAll('[aria-modal="true"]');
      if ((current == null || current === document.body) && dialogs[dialogs.length - 1] === element) {
        element.focus({ preventScroll: true });
      }
    };
    const onFocusOut = (event: globalThis.FocusEvent) => {
      if (event.relatedTarget == null) {
        queueMicrotask(rehome);
      }
    };
    const observer = new MutationObserver(rehome);
    element.addEventListener('focusout', onFocusOut);
    observer.observe(element, { childList: true, subtree: true });

    return () => {
      releaseModal?.();
      element.removeEventListener('focusout', onFocusOut);
      observer.disconnect();
      focusedBefore.current = null;
      const current = document.activeElement;
      const ours = current == null || current === document.body || element.contains(current);
      if (!opener) {
        return;
      }
      if (!opener.isConnected) {
        if (ours && fallback?.isConnected) {
          focusFallback(fallback);
        }
      } else if (ours) {
        opener.focus();
      } else if (current.closest('[aria-modal="true"]')) {
        handedOver = opener;
        queueMicrotask(() => {
          handedOver = null;
        });
      }
    };
  }, [isOpen, isolate]);

  const ref = useCallback((element: HTMLElement | null) => {
    container.current = element;
  }, []);

  const onFocus = (event: FocusEvent<HTMLElement>) => {
    const from = event.relatedTarget;
    if (focusedBefore.current == null && from instanceof HTMLElement && !event.currentTarget.contains(from)) {
      focusedBefore.current = from;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const element = container.current;
    if (!element || !element.contains(event.target as Node)) {
      return;
    }
    if (event.key === 'Escape' && onEscape && !event.defaultPrevented) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }
    if (event.key !== 'Tab' || !modal) {
      return;
    }
    const tabbable = tabbableElements(element);
    if (tabbable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = tabbable[0];
    const last = tabbable[tabbable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === element)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const getDialogProps = (): DialogFocusProps => ({ ref, tabIndex: -1, onKeyDown, onFocus });

  return { getDialogProps };
}

export function useDialogReturnFocus(): ReturnFocusTo | undefined {
  return useContext(DialogReturnFocusContext);
}
