// The app proper, loaded by index.tsx once the capability preflight passes.
// @critical Must be the first import. See .github/instructions/webatrice.instructions.md#initialization-order.
import './polyfills';

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material/styles';

import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';
import { extensions } from '@app/store';
import { loadTimingMiddleware } from './store/loadTimingMiddleware';
import { AppThemeProvider, UserAvatarProvider } from '@app/components';
import { bootColorScheme, debugLog, followBootColorScheme, initAnalytics, installConsoleCapture } from '@app/services';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from './clientConfig';
import AppShell from './AppShell';
import CardPreviewPopupPage from './features/game/components/CardPreviewPopup/CardPreviewPopupPage';

import './i18n';
import './index.css';
import { registerAfterPaint } from './services/serviceWorker/register';
import BootSession, { prepareBootSession } from './BootSession';

installConsoleCapture();
debugLog.setHeader([
  `Client: ${CLIENT_CONFIG.clientid} ${CLIENT_CONFIG.clientver}`,
  `Browser: ${navigator.userAgent}`,
  `Locale: ${navigator.language}`,
  '-'.repeat(75),
]);

// CssBaseline is gone, so MUI no longer dictates global CSS. MUI's
// ThemeProvider is back only inside AppThemeProvider, to keep the colours
// MUI computes itself on the active palette (see services/theme/muiTheme.ts).
// `<StyledEngineProvider injectFirst>` stays because it doesn't
// reintroduce any MUI opinions — it just makes emotion inject at the
// top of <head> so our static index.css (loaded later) wins the
// specificity-tie cascade over MUI's runtime-generated .css-abc-Mui*
// classes. Without it, our mui-overrides.css never gets to color a
// single MUI component.
const App = ({ preparation }: { preparation: ReturnType<typeof prepareBootSession> }) => (
  <DatatriceProvider extensions={extensions} additionalMiddleware={[loadTimingMiddleware]}>
    <WebClientProvider config={CLIENT_CONFIG} options={CLIENT_OPTIONS}>
      <BootSession preparation={preparation}>
        <StrictMode>
          <StyledEngineProvider injectFirst>
            <AppThemeProvider>
              <Suspense fallback="loading">
                <UserAvatarProvider>
                  <AppShell />
                </UserAvatarProvider>
              </Suspense>
            </AppThemeProvider>
          </StyledEngineProvider>
        </StrictMode>
      </BootSession>
    </WebClientProvider>
  </DatatriceProvider>
);

// Popup carve-out: the card-preview popup opens as a fresh browser
// window (window.open with a hash of `#/card-preview-popup`) and
// boots the same bundle. Detect that hash at entry and render only
// the popup page — no MemoryRouter, no DatatriceProvider, no
// WebClientProvider. The popup receives its data via BroadcastChannel
// from the main window, so it needs none of the app plumbing.
const isCardPreviewPopup =
  typeof window !== 'undefined'
  && window.location.hash === '#/card-preview-popup';

bootColorScheme();
if (isCardPreviewPopup) {
  followBootColorScheme();
}

// Bootstrap Google Analytics from the per-deploy runtime config. No-ops when no
// measurement id was injected for this environment (see services/analytics.ts).
initAnalytics();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(isCardPreviewPopup ? <CardPreviewPopupPage /> : <App preparation={prepareBootSession()} />);
registerAfterPaint();
