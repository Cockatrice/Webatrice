import { Route, Routes } from 'react-router-dom';

import { RouteEnum } from '@app/types';
import { Account } from '@app/features/account';
import { Decks } from '@app/features/decks';
import { Game } from '@app/features/game';
import { Logs } from '@app/features/logs';
import { Player } from '@app/features/player';
import { Login } from '@app/features/login';
import { Room } from '@app/features/rooms';
import { Server } from '@app/features/server';
import { Settings } from '@app/features/settings';
import { Initialize, Unsupported } from '@app/features/shell';

const AppShellRoutes = () => (
  <div className="AppShell-routes overflow-scroll">
    <Routes>
      <Route path='*' element={<Initialize />} />

      <Route path={RouteEnum.ACCOUNT} element={<Account />} />
      <Route path={RouteEnum.DECKS} element={<Decks />} />
      <Route path={RouteEnum.GAME} element={<Game />} />
      <Route path={RouteEnum.LOGS} element={<Logs />} />
      <Route path={RouteEnum.PLAYER} element={<Player />} />
      {<Route path={RouteEnum.ROOM} element={<Room />} />}
      <Route path={RouteEnum.SERVER} element={<Server />} />
      <Route path={RouteEnum.SETTINGS} element={<Settings />} />
      <Route path={RouteEnum.LOGIN} element={<Login />} />
      <Route path={RouteEnum.UNSUPPORTED} element={<Unsupported />} />
    </Routes>
  </div>
);

export default AppShellRoutes;
