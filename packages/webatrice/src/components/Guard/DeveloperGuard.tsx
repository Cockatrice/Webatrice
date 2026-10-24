import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useUserCapabilities } from '@app/hooks';
import { RouteEnum } from '@app/types';

interface DeveloperGuardProps {
  children?: ReactNode;
}

const DeveloperGuard = ({ children }: DeveloperGuardProps) => {
  const { isDeveloper } = useUserCapabilities();
  return !isDeveloper
    ? <Navigate to={RouteEnum.SERVER} />
    : <>{children}</>;
};

export default DeveloperGuard;
