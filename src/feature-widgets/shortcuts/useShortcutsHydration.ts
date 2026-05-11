import { useEffect } from 'react';

import { LoadingState, useSettings } from '@app/hooks';
import { ShortcutsDispatch, ShortcutsSelectors, useAppSelector } from '@app/store';

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
