import { useEffect } from 'react';

import { LoadingState, useSettings } from '@app/hooks';
import { ShortcutsDispatch, ShortcutsSelectors, useAppSelector } from '@app/store';

/**
 * One-shot bridge: when SettingDTO has loaded from Dexie, copy `settings.shortcuts`
 * (if any) into the Redux slice. Persistence in the other direction is handled by
 * useShortcutsPersistence — this hook only handles the initial Dexie → Redux direction.
 */
export function useShortcutsHydration(): void {
  const settings = useSettings();
  const hydrated = useAppSelector(ShortcutsSelectors.getHydrated);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    if (settings.status !== LoadingState.READY) {
      return;
    }
    ShortcutsDispatch.hydrate(settings.value?.shortcuts ?? {});
  }, [settings.status, settings.value, hydrated]);
}
