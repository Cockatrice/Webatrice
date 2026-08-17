import { Suspense, useEffect, useMemo } from 'react';
import { MemoryRouter as Router } from 'react-router-dom';
import Routes from './AppShellRoutes';

import './AppShell.css';

import { ToastProvider } from '@app/components';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import { PrivateMessageNotifier } from '@app/features/player';
import { FeatureDetection } from '@app/features/shell';
import { loadPersistedLastRoute } from './components/layout/TopBar';

// CssBaseline removed: it was MUI's global body reset (font, color,
// background, box-sizing, anchor styles). The equivalent rules now
// live in index.css so we control them without MUI's opinions.
function AppShell() {
  useEffect(() => {
    window.onbeforeunload = () => true;
    return () => {
      window.onbeforeunload = null;
    };
  }, []);

  // Rehydrate the last route from localStorage so an F5 refresh drops
  // the user back where they were. MemoryRouter has no URL bar, so
  // without this the router always boots at `/`. `useMemo` freezes
  // the initialEntries at first render — MemoryRouter uses it once
  // and remembers, so subsequent state updates don't rehydrate.
  const initialEntries = useMemo(() => {
    const saved = loadPersistedLastRoute();
    return saved ? [saved] : ['/'];
  }, []);

  return (
    <Suspense fallback="loading">
      <ToastProvider>
        <div className="AppShell">
          <Router initialEntries={initialEntries}>
            <ShortcutProvider>
              <FeatureDetection />
              {/* Global listener for incoming private-chat messages —
               *  renders nothing, dispatches Toast pills whose
               *  onClick navigates to the sender's /player/:name
               *  tab. Mounted inside the Router so useNavigate /
               *  useLocation work; inside ToastProvider so pushToast
               *  is available. */}
              <PrivateMessageNotifier />
              <Routes />
            </ShortcutProvider>
          </Router>
        </div>
      </ToastProvider>
    </Suspense>
  );
}

export default AppShell;
