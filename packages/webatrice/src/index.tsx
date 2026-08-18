// @critical Must be the first import. See .github/instructions/webatrice.instructions.md#initialization-order.
import './polyfills';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material';

import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';
import { extensions } from '@app/store';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from './clientConfig';
import AppShell from './AppShell';

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
          <AppShell />
        </StyledEngineProvider>
      </StrictMode>
    </WebClientProvider>
  </DatatriceProvider>
);

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<App />);
