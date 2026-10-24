import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { server, type ServerCapability } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';

interface CapabilityGuardProps {
  capability: ServerCapability;
  children?: ReactNode;
}

const CapabilityGuard = ({ capability, children }: CapabilityGuardProps) => {
  const supported = useAppSelector((state) => server.Selectors.supports(state, capability));
  return !supported
    ? <Navigate to={RouteEnum.SERVER} />
    : <>{children}</>;
};

export default CapabilityGuard;
