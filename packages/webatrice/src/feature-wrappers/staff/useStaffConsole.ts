import { matchPath, useLocation } from 'react-router-dom';

import { server } from '@cockatrice/datatrice';
import { isModerator, useAdminLock } from '@app/hooks';
import { useAppSelector } from '@app/store';

import type { StaffToolId, StaffToolState } from './staffTools';
import { useStaffTools } from './useStaffTools';

export interface StaffConsole {
  tools: StaffToolState[];
  activeId: StaffToolId | null;
  unresolvedReports: number | null;
  showLock: boolean;
  locked: boolean;
  setLocked: (locked: boolean) => void;
}

export function useStaffConsole(): StaffConsole {
  const { pathname } = useLocation();
  const userLevel = useAppSelector((state) => server.Selectors.getUser(state)?.userLevel ?? 0);
  const queueLoaded = useAppSelector(server.Selectors.getReportQueueLoaded);
  const counts = useAppSelector(server.Selectors.getReportQueueStatusCounts);
  const [locked, setLocked] = useAdminLock();
  const { states } = useStaffTools();

  const activeId = states.find(({ tool }) => matchPath({ path: tool.route, end: true }, pathname))?.tool.id ?? null;

  return {
    tools: states,
    activeId,
    unresolvedReports: queueLoaded ? counts.open + counts.assigned : null,
    showLock: isModerator(userLevel),
    locked,
    setLocked,
  };
}
