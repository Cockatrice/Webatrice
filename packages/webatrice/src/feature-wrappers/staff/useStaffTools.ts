import { useMemo } from 'react';

import { server } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';

import type { RouteEnum } from '@app/types';

import { staffHomeRoute, staffToolStates, versionSupports, type StaffToolId, type StaffToolState } from './staffTools';

export interface StaffTools {
  states: StaffToolState[];
  home: RouteEnum | null;
}

export function useStaffTools(): StaffTools {
  const userLevel = useAppSelector((state) => server.Selectors.getUser(state)?.userLevel ?? 0);
  const version = useAppSelector(server.Selectors.getVersion);
  return useMemo(() => {
    const states = staffToolStates(userLevel, versionSupports(version));
    return { states, home: staffHomeRoute(states) };
  }, [userLevel, version]);
}

export function useStaffToolAvailable(id: StaffToolId): boolean {
  const { states } = useStaffTools();
  return states.some(({ tool, available }) => tool.id === id && available);
}
