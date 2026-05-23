import { useEffect, useRef } from 'react';

import { LoadingState, useSettings } from '@app/hooks';
import { shortcuts, useAppSelector } from '@app/store';

export function useShortcutsPersistence(): void {
  const settings = useSettings();
  const hydrated = useAppSelector(shortcuts.Selectors.getHydrated);
  const overrides = useAppSelector(shortcuts.Selectors.getOverrides);
  const lastSeenOverrides = useRef<typeof overrides | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (settings.status !== LoadingState.READY) {
      return;
    }
    if (lastSeenOverrides.current === null) {
      lastSeenOverrides.current = overrides;
      return;
    }
    if (lastSeenOverrides.current === overrides) {
      return;
    }
    lastSeenOverrides.current = overrides;
    void settings.update({ shortcuts: overrides });
  }, [hydrated, overrides, settings]);
}
