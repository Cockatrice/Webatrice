import { Route, Routes } from 'react-router-dom';

import { App } from '@app/types';
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

      <Route path={App.RouteEnum.ACCOUNT} element={<Account />} />
      <Route path={App.RouteEnum.DECKS} element={<Decks />} />
      <Route path={App.RouteEnum.GAME} element={<Game />} />
      <Route path={App.RouteEnum.LOGS} element={<Logs />} />
      <Route path={App.RouteEnum.PLAYER} element={<Player />} />
      {<Route path={App.RouteEnum.ROOM} element={<Room />} />}
      <Route path={App.RouteEnum.SERVER} element={<Server />} />
      <Route path={App.RouteEnum.SETTINGS} element={<Settings />} />
      <Route path={App.RouteEnum.LOGIN} element={<Login />} />
      <Route path={App.RouteEnum.UNSUPPORTED} element={<Unsupported />} />
    </Routes>
  </div>
);

export default AppShellRoutes;
