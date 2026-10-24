import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { RouteEnum } from '@app/types';

export const INVESTIGATE_USER_PARAM = 'user';

export function userInvestigationPath(userName: string): string {
  const params = new URLSearchParams({ [INVESTIGATE_USER_PARAM]: userName });
  return `${RouteEnum.MODERATION}?${params.toString()}`;
}

export function useOpenUserInvestigation(): (userName: string) => void {
  const navigate = useNavigate();
  return useCallback((userName: string) => navigate(userInvestigationPath(userName)), [navigate]);
}
