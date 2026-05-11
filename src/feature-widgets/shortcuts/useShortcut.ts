import { useContext, useEffect, useRef } from 'react';

import { App } from '@app/types';

import { ShortcutContext } from './shortcutContext';

export interface UseShortcutOptions {
  scope: App.ShortcutScope;
  /** Call event.preventDefault() before invoking the handler. Default true. */
  preventDefault?: boolean;
  /** Skip registration entirely. Useful for conditionally-active bindings. */
  enabled?: boolean;
}

/**
 * Subscribe a component to a registered shortcut action. The handler fires only when the
 * route-based scope is active (or when scope is GLOBAL).
 *
 * Handler is captured via a ref so callers don't need to memoize it; the registration
 * itself is stable across renders unless actionId, scope, or enabled change.
 */
export function useShortcut(
  actionId: string,
  handler: App.ShortcutHandler,
  options: UseShortcutOptions,
): void {
  const { register } = useContext(ShortcutContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const { scope, preventDefault = true, enabled = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return register({
      actionId,
      handler: (event) => handlerRef.current(event),
      scope,
      preventDefault,
    });
  }, [register, actionId, scope, preventDefault, enabled]);
}
