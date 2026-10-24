import { Suspense, useSyncExternalStore } from 'react';
import { Route, Routes } from 'react-router-dom';
import RouteTimings from './RouteTimings';
import RouteLoading from './RouteLoading';
import RoutePrefetch from './RoutePrefetch';
import { lazyRoutes } from './lazyRoutes';
import { homePreview } from './services/storage/homeSnapshot';
import ReconnectingHome from './features/server/ReconnectingHome';

import { RouteEnum } from '@app/types';
import { Login } from '@app/features/login';
import { Server } from '@app/features/server';
import { Initialize, Unsupported } from '@app/features/shell';
import StaffToolGuard from './feature-wrappers/staff/StaffToolGuard';
import RouteFocus from './feature-wrappers/layout/RouteFocus';

const {
  Account: { Component: Account },
  Administration: { Component: Administration },
  CardArtRules: { Component: CardArtRules },
  Decks: { Component: Decks },
  DeckEditor: { Component: DeckEditor },
  PublicDecks: { Component: PublicDecks },
  SharedDeck: { Component: SharedDeck },
  Developer: { Component: Developer },
  Game: { Component: Game },
  GameReplay: { Component: GameReplay },
  Logs: { Component: Logs },
  Moderation: { Component: Moderation },
  Player: { Component: Player },
  People: { Component: People },
  Replays: { Component: Replays },
  MyReports: { Component: MyReports },
  ReportQueue: { Component: ReportQueue },
  Room: { Component: Room },
  Settings: { Component: Settings },
  Shortcuts: { Component: Shortcuts },
} = lazyRoutes;

const AppShellRoutes = () => {
  const snapshot = useSyncExternalStore(homePreview.subscribe, homePreview.get);
  return (
    <>
      {snapshot && <ReconnectingHome snapshot={snapshot} />}
      <div hidden={Boolean(snapshot)} className="AppShell-routes scrollable no-gutter">
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path='*' element={<Initialize />} />

            <Route path={RouteEnum.ACCOUNT} element={<Account />} />
            <Route path={RouteEnum.ADMINISTRATION} element={<StaffToolGuard tool="administration"><Administration /></StaffToolGuard>} />
            <Route path={RouteEnum.CARD_ART_RULES} element={<StaffToolGuard tool="cardArtRules"><CardArtRules /></StaffToolGuard>} />
            <Route path={RouteEnum.DECKS} element={<Decks />} />
            <Route path={RouteEnum.DECK} element={<DeckEditor />} />
            <Route path={RouteEnum.DECK_DRAFT} element={<DeckEditor />} />
            <Route path={RouteEnum.SHARED_DECK} element={<SharedDeck />} />
            <Route path={RouteEnum.PUBLIC_DECKS} element={<PublicDecks />} />
            <Route path={RouteEnum.DEVELOPER} element={<StaffToolGuard tool="developer"><Developer /></StaffToolGuard>} />
            <Route path={RouteEnum.GAME} element={<Game />} />
            <Route path={RouteEnum.LOGS} element={<StaffToolGuard tool="logs"><Logs /></StaffToolGuard>} />
            <Route path={RouteEnum.MODERATION} element={<StaffToolGuard tool="moderation"><Moderation /></StaffToolGuard>} />
            <Route path={RouteEnum.PLAYER} element={<Player />} />
            <Route path={RouteEnum.PEOPLE} element={<People />} />
            <Route path={RouteEnum.REPLAYS} element={<Replays />} />
            <Route path={RouteEnum.REPLAY} element={<GameReplay />} />
            <Route path={RouteEnum.ROOM} element={<Room />} />
            <Route path={RouteEnum.SERVER} element={<><Server /><RoutePrefetch /></>} />
            <Route path={RouteEnum.SETTINGS} element={<Settings />} />
            <Route path={RouteEnum.SHORTCUTS} element={<Shortcuts />} />
            <Route path={RouteEnum.MY_REPORTS} element={<MyReports />} />
            <Route path={RouteEnum.REPORT_QUEUE} element={<StaffToolGuard tool="reports"><ReportQueue /></StaffToolGuard>} />
            <Route path={RouteEnum.LOGIN} element={<Login />} />
            <Route path={RouteEnum.UNSUPPORTED} element={<Unsupported />} />
          </Routes>
          <RouteFocus />
          <RouteTimings />
        </Suspense>
      </div>
    </>
  );
};

export default AppShellRoutes;
