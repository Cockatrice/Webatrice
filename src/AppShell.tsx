import { Suspense, useEffect } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter as Router } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from '@app/store';
import Routes from './AppShellRoutes';

import './AppShell.css';

import { ToastProvider } from '@app/components';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import { FeatureDetection } from '@app/features/shell';

function AppShell() {
  useEffect(() => {
    window.onbeforeunload = () => true;
    return () => {
      window.onbeforeunload = null;
    };
  }, []);

  return (
    <Suspense fallback="loading">
      <Provider store={store}>
        <CssBaseline />
        <ToastProvider>
          <div className="AppShell">
            <Router>
              <ShortcutProvider>
                <FeatureDetection />
                <Routes />
              </ShortcutProvider>
            </Router>
          </div>
        </ToastProvider>
      </Provider>
    </Suspense>
  );
}

export default AppShell;
