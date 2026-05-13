import { useContext, useEffect, useRef } from 'react';

import { ShortcutHandler, ShortcutScope } from '@app/types';
import { ShortcutContext } from './shortcutContext';

export interface UseShortcutOptions {
  scope: ShortcutScope;
  preventDefault?: boolean;
  enabled?: boolean;
}

export function useShortcut(
  actionId: string,
  handler: ShortcutHandler,
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
