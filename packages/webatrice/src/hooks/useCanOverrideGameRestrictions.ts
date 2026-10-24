import { useAdminLocked } from './useAdminLock';
import { useUserCapabilities } from './useUserCapabilities';

export function useCanOverrideGameRestrictions(): boolean {
  const { isModerator, isJudge } = useUserCapabilities();
  const locked = useAdminLocked();
  return (isModerator && !locked) || isJudge;
}
