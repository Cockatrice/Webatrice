import { Suspense, useEffect } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter as Router } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from '@app/store';
import Routes from './AppShellRoutes';
import FeatureDetection from './FeatureDetection';

import './AppShell.css';

import { ToastProvider } from '@app/components';
import { ShortcutProvider } from '@app/features/shortcuts';

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
