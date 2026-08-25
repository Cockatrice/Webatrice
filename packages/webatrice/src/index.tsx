// @critical Must be the first import. See .github/instructions/webatrice.instructions.md#initialization-order.
import './polyfills';

import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material';

import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';
import { extensions } from '@app/store';
import { initAnalytics } from '@app/services';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from './clientConfig';
import AppShell from './AppShell';
import CardPreviewPopupPage from './features/game/components/CardPreviewPopup/CardPreviewPopupPage';

import './i18n';
import './index.css';

// MUI's ThemeProvider + CssBaseline are gone; MUI components render
// with their built-in defaults and no longer dictate global CSS.
// `<StyledEngineProvider injectFirst>` stays because it doesn't
// reintroduce any MUI opinions — it just makes emotion inject at the
// top of <head> so our static index.css (loaded later) wins the
// specificity-tie cascade over MUI's runtime-generated .css-abc-Mui*
// classes. Without it, our mui-overrides.css never gets to color a
// single MUI component.
const App = () => (
  <DatatriceProvider extensions={extensions}>
    <WebClientProvider config={CLIENT_CONFIG} options={CLIENT_OPTIONS}>
      <StrictMode>
        <StyledEngineProvider injectFirst>
          <Suspense fallback="loading">
            <AppShell />
          </Suspense>
        </StyledEngineProvider>
      </StrictMode>
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

// Bootstrap Google Analytics from the per-deploy runtime config. No-ops when no
// measurement id was injected for this environment (see services/analytics.ts).
initAnalytics();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(isCardPreviewPopup ? <CardPreviewPopupPage /> : <App />);
