import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';

import {
  applyColorScheme,
  bootThemeMode,
  bootThemeName,
  type ColorScheme,
  resolveColorScheme,
  resolveThemeName,
  subscribeToSystemColorScheme,
  systemColorScheme,
  writeBootThemeMode,
  writeBootThemeName,
} from '@app/services';
import type { ThemeName } from '@app/types';
import { usePreference, useSettings } from './useSettings';
import { LoadingState } from './useSharedStore';

export function useSystemColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribeToSystemColorScheme, systemColorScheme, () => 'dark');
}

export function useColorScheme(): ColorScheme {
  const ready = useSettings().status === LoadingState.READY;
  const preference = usePreference('themeMode');
  const system = useSystemColorScheme();
  return resolveColorScheme(ready ? preference : bootThemeMode(), system);
}

export function useThemeName(): ThemeName {
  const ready = useSettings().status === LoadingState.READY;
  const preference = usePreference('themeName');
  return ready ? resolveThemeName(preference) : bootThemeName();
}

export interface AppliedTheme {
  scheme: ColorScheme;
  themeName: ThemeName;
}

export function useApplyColorScheme(): AppliedTheme {
  const scheme = useColorScheme();
  const themeName = useThemeName();
  const ready = useSettings().status === LoadingState.READY;
  const mode = usePreference('themeMode');

  useLayoutEffect(() => {
    applyColorScheme(scheme, themeName);
  }, [scheme, themeName]);

  useEffect(() => {
    if (ready) {
      writeBootThemeMode(mode);
      writeBootThemeName(themeName);
    }
  }, [ready, mode, themeName]);

  return { scheme, themeName };
}
