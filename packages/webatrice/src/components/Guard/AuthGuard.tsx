import { Navigate } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
const AuthGuard = () => {
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  return !isConnected
    ? <Navigate to={RouteEnum.LOGIN} />
    : <></>;
};

export default AuthGuard;
