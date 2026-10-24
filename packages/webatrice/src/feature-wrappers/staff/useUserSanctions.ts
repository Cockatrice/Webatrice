import { useModerationMenu } from '@app/feature-widgets/moderation';

import { menuAllows } from './userSanctions';

export interface UserSanctions {
  canWarn: boolean;
  canBan: boolean;
  warn: () => void;
  ban: () => void;
}

export function useUserSanctions(userName: string): UserSanctions {
  const { groups, open } = useModerationMenu(userName);
  return {
    canWarn: menuAllows(groups, 'warnUser'),
    canBan: menuAllows(groups, 'banUser'),
    warn: () => open('warnUser'),
    ban: () => open('banUser'),
  };
}
