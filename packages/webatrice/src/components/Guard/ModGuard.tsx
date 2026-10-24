import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useUserCapabilities } from '@app/hooks';
import { RouteEnum } from '@app/types';

interface ModGuardProps {
  children?: ReactNode;
}

const ModGuard = ({ children }: ModGuardProps) => {
  const { isModerator } = useUserCapabilities();
  return !isModerator
    ? <Navigate to={RouteEnum.SERVER} />
    : <>{children}</>;
};

export default ModGuard;
