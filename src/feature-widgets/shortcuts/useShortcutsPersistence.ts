import { useEffect, useRef } from 'react';

import { LoadingState, useSettings } from '@app/hooks';
import { ShortcutsSelectors, useAppSelector } from '@app/store';

/**
 * Mirrors the slice's `overrides` map back to Dexie via `useSettings().update()` whenever
 * it changes after hydration. The first observation post-hydration is skipped — it's the
 * value we just hydrated FROM, no need to write it back.
 *
 * Lives in the feature layer (not as Redux listener middleware) because the boundaries
 * config forbids `store/* → hooks/*`. Settings persistence is owned by the hook layer.
 */
export function useShortcutsPersistence(): void {
  const settings = useSettings();
  const hydrated = useAppSelector(ShortcutsSelectors.getHydrated);
  const overrides = useAppSelector(ShortcutsSelectors.getOverrides);
  const lastSeenOverrides = useRef<typeof overrides | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (settings.status !== LoadingState.READY) {
      return;
    }
    // Skip the first observation: it's the value we just hydrated FROM.
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
