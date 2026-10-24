import { createContext, useContext, useMemo } from 'react';

import { server, ServerCapability } from '@cockatrice/datatrice';
import { useAdminLocked } from '@app/hooks';
import { useAppSelector } from '@app/store';

import { buildModerationMenu, type ModerationAction, type ModerationMenuGroups } from './moderationMenu';

export interface ModerationApi {
  open: (action: ModerationAction, userName: string) => void;
}

export const ModerationContext = createContext<ModerationApi | null>(null);

export interface ModerationMenu {
  groups: ModerationMenuGroups;
  open: (action: ModerationAction) => void;
}

const EMPTY_GROUPS: ModerationMenuGroups = [];

export function useModerationMenu(userName: string, userLevel?: number): ModerationMenu {
  const api = useContext(ModerationContext);
  const localUser = useAppSelector(server.Selectors.getUser);
  const knownLevel = useAppSelector((state) =>
    server.Selectors.getUsers(state)[userName]?.userLevel
    ?? server.Selectors.getUserInfoByName(state, userName)?.userLevel,
  );
  const targetUserLevel = userLevel ?? knownLevel ?? 0;
  const localUserLevel = localUser?.userLevel ?? 0;
  const isSelf = localUser?.name === userName;
  const supportsDeveloperRole = useAppSelector((state) =>
    server.Selectors.supports(state, ServerCapability.DEVELOPER_ROLE),
  );
  const adminLocked = useAdminLocked();

  const groups = useMemo(
    () => (api
      ? buildModerationMenu({ localUserLevel, targetUserLevel, isSelf, supportsDeveloperRole, adminLocked, canInvestigate: true })
      : EMPTY_GROUPS),
    [api, localUserLevel, targetUserLevel, isSelf, supportsDeveloperRole, adminLocked],
  );
  const open = useMemo(
    () => (action: ModerationAction) => api?.open(action, userName),
    [api, userName],
  );

  return useMemo(() => ({ groups, open }), [groups, open]);
}
