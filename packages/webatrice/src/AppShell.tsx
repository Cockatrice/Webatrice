import { useEffect, useMemo } from 'react';
import { MemoryRouter as Router } from 'react-router-dom';
import Routes from './AppShellRoutes';

import './AppShell.css';

import { GameLinkJoinHost, RouteErrorBoundary, ToastProvider } from '@app/components';
import { ReportUserProvider } from '@app/dialogs';
import { useAdminLockSession, useApplyLanguagePreference, useDocumentLanguage, useSyncLocaleToStore } from '@app/hooks';
import { handleBeforeUnload, loadPersistedLastRoute } from '@app/services';
import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import { ModerationProvider } from '@app/feature-widgets/moderation';
import { UserGamesProvider } from '@app/feature-widgets/user-games';
import { ChatDock } from '@app/feature-widgets/chat-dock';
import { NotificationCentre } from '@app/feature-widgets/notifications';
import { useLiveServerEndpoint } from '@app/feature-widgets/known-hosts';
import { DeckShareLinkRedirect } from './features/decks/components/DeckShareLinkRedirect';
import { LobbyDeckStateProvider } from './features/game/components/lobby/LobbyDeckStateProvider';
import PrivateMessageNotifier from './features/player/PrivateMessageNotifier';
import ReportNotifier from './features/reports/ReportNotifier';
import { AppAlerts, CommandFailureNotices, FeatureDetection, MissingFeaturesNotice, ServerNotices } from '@app/features/shell';
import { usePlaymatSync } from './features/game/hooks/usePlaymatSync';
import { useDeckSummaryInvalidation } from './features/decks/hooks/useDeckSummaryInvalidation';
import { SessionScope } from './SessionScope';
import { useGuestGameUnloadRisk } from './hooks/useGuestGameUnloadRisk';

// CssBaseline removed: it was MUI's global body reset (font, color,
// background, box-sizing, anchor styles). The equivalent rules now
// live in index.css so we control them without MUI's opinions.
function AppShell() {
  useGuestGameUnloadRisk();
  useDeckSummaryInvalidation();
  usePlaymatSync();
  useSyncLocaleToStore();
  useAdminLockSession();
  useDocumentLanguage();
  useApplyLanguagePreference();
  const liveServer = useLiveServerEndpoint();

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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
    <ToastProvider>
      <div className="AppShell">
        <Router initialEntries={initialEntries}>
          <ShortcutProvider>
            <FeatureDetection />
            <CommandFailureNotices />
            <ServerNotices />
            <MissingFeaturesNotice />
            <SessionScope>
              {/* Global listener for incoming private-chat messages —
               *  renders nothing, dispatches Toast pills whose
               *  onClick navigates to the sender's /player/:name
               *  tab. Mounted inside the Router so useNavigate /
               *  useLocation work; inside ToastProvider so pushToast
               *  is available. */}
              <PrivateMessageNotifier />
              <AppAlerts />
              <GameLinkJoinHost endpoint={liveServer} />
              <ReportNotifier />
              <ReportUserProvider>
                <ModerationProvider>
                  <UserGamesProvider>
                    <LobbyDeckStateProvider>
                      <RouteErrorBoundary>
                        <Routes />
                      </RouteErrorBoundary>
                      <ChatDock />
                      <NotificationCentre />
                    </LobbyDeckStateProvider>
                  </UserGamesProvider>
                </ModerationProvider>
              </ReportUserProvider>
            </SessionScope>
            <DeckShareLinkRedirect />
          </ShortcutProvider>
        </Router>
      </div>
    </ToastProvider>
  );
}

export default AppShell;
