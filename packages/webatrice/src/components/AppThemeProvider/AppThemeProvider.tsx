import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';

import { useApplyAnimationPolicy, useApplyCardPresentation, useApplyColorScheme } from '@app/hooks';
import { createAppTheme } from '@app/services';

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const { scheme, themeName } = useApplyColorScheme();
  useApplyCardPresentation();
  useApplyAnimationPolicy();
  const theme = useMemo(() => createAppTheme(themeName, scheme), [themeName, scheme]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
