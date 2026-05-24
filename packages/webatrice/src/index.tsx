// @critical Must be the first import. See .github/instructions/webatrice.instructions.md#initialization-order.
import './polyfills';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StyledEngineProvider } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';

import { DatatriceProvider, WebClientProvider } from '@cockatrice/datatrice/react';
import { extensions } from '@app/store';
import { CLIENT_CONFIG, CLIENT_OPTIONS } from './clientConfig';
import AppShell from './AppShell';
import { materialTheme } from './material-theme';

import './i18n';
import './colors.css';
import './index.css';

const AppWithMaterialTheme = () => {
  return (
    <DatatriceProvider extensions={extensions}>
      <WebClientProvider config={CLIENT_CONFIG} options={CLIENT_OPTIONS}>
        <StrictMode>
          <StyledEngineProvider injectFirst>
            <ThemeProvider theme={materialTheme}>
              <AppShell />
            </ThemeProvider>
          </StyledEngineProvider>
        </StrictMode>
      </WebClientProvider>
    </DatatriceProvider>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<AppWithMaterialTheme />);
