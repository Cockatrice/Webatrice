import { useEffect } from 'react';

import { LoadingState, useSettings } from '@app/hooks';
import { shortcuts, useAppDispatch, useAppSelector } from '@app/store';

export function useShortcutsHydration(): void {
  const dispatch = useAppDispatch();
  const settings = useSettings();
  const hydrated = useAppSelector(shortcuts.Selectors.getHydrated);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    if (settings.status !== LoadingState.READY) {
      return;
    }
    dispatch(shortcuts.Actions.hydrate({ overrides: settings.value?.shortcuts ?? {} }));
  }, [dispatch, settings.status, settings.value, hydrated]);
}
