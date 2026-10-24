import { Navigate, useLocation } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum, type LoginRouteState } from '@app/types';

const AuthGuard = () => {
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const { pathname, search } = useLocation();
  if (isConnected || pathname === RouteEnum.LOGIN) {
    return <></>;
  }
  return <Navigate to={RouteEnum.LOGIN} state={{ from: pathname + search } satisfies LoginRouteState} />;
};

export default AuthGuard;
