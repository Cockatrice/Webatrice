import { Navigate } from 'react-router-dom';

import { server } from 'datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
const ModGuard = () => {
  const isModerator = useAppSelector(server.Selectors.getIsUserModerator);
  return !isModerator
    ? <Navigate to={RouteEnum.SERVER} />
    : <></>;
};

export default ModGuard;
