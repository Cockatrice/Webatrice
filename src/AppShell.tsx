import { Suspense, useEffect } from 'react';
import { MemoryRouter as Router } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
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
    </Suspense>
  );
}

export default AppShell;
