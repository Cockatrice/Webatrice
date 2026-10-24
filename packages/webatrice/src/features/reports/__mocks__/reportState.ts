import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { makeReport, makeReportsState } from '@cockatrice/datatrice/testing';
import type { ServerStateReports } from '@cockatrice/datatrice';

import { connectedState, makeUser } from '../../../__test-utils__';
import type { RootState } from '../../../store';

export const SERVER_31 = '3.1.0 (2026-08-21)';
export const SERVER_30 = '3.0.0 ()';

const Flag = ServerInfo_User_UserLevelFlag;

export { makeReport };

export function reportsRootState(options: {
  version?: string;
  moderator?: boolean;
  reports?: Partial<ServerStateReports>;
} = {}): Partial<RootState> {
  const { version = SERVER_31, moderator = false, reports } = options;
  const userLevel = Flag.IsRegistered | (moderator ? Flag.IsModerator : 0);
  return {
    ...connectedState,
    server: {
      ...(connectedState.server as RootState['server']),
      info: { message: null, name: 'Test Server', version },
      user: makeUser({ name: moderator ? 'modA' : 'alice', userLevel }),
      reports: makeReportsState(reports),
    },
  };
}
