import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { RouteEnum } from '@app/types';

import type { StaffToolId } from './staffTools';
import { useStaffToolAvailable } from './useStaffTools';

export default function StaffToolGuard({ tool, children }: { tool: StaffToolId; children: ReactNode }) {
  return useStaffToolAvailable(tool) ? <>{children}</> : <Navigate to={RouteEnum.SERVER} replace />;
}
