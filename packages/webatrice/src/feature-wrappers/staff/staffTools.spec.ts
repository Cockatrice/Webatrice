import { ServerCapability } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';

import {
  commandsSupported, isStaff, SERVER_BASELINE, STAFF_COMMAND_REQUIRES, STAFF_TOOLS, staffHomeRoute, staffToolStates,
  versionSupports, type CapabilityCheck, type StaffCommand,
} from './staffTools';

const { IsRegistered, IsModerator, IsAdmin, IsJudge, IsDeveloper } = ServerInfo_User_UserLevelFlag;
const v30 = versionSupports('3.0.0 ()');
const v31 = versionSupports('3.1.0 ()');
const MODERATOR = IsRegistered | IsModerator;
const ADMIN = MODERATOR | IsAdmin;

const states = (level: number, supports: CapabilityCheck) =>
  staffToolStates(level, supports).map(({ tool, available }) => [tool.id, available]);

describe('STAFF_COMMAND_REQUIRES', () => {
  const answeredBy30: StaffCommand[] = [
    'getUserInfo', 'warnUser', 'getWarnList', 'getWarnHistory', 'banFromServer', 'getBanHistory', 'getAdminNotes',
    'updateAdminNotes', 'viewLogHistory', 'grantReplayAccess', 'forceActivateUser', 'updateServerMessage', 'shutdownServer',
    'reloadConfig',
  ];

  it('needs only a recognised server for the commands Servatrice 3.0 answers', () => {
    answeredBy30.forEach((command) => expect([command, STAFF_COMMAND_REQUIRES[command]]).toEqual([command, SERVER_BASELINE]));
  });

  it('needs a 3.1 capability for every other staff command', () => {
    const rest = (Object.keys(STAFF_COMMAND_REQUIRES) as StaffCommand[]).filter((command) => !answeredBy30.includes(command));
    rest.forEach((command) => {
      expect(commandsSupported([command], v30)).toBe(false);
      expect(commandsSupported([command], v31)).toBe(true);
    });
  });

  it('checks every command a part uses', () => {
    const cardArtOnly: CapabilityCheck = (requirement) => requirement === SERVER_BASELINE || requirement === ServerCapability.CARD_ART;
    expect(commandsSupported(['listCardArtRules', 'getUserInfo'], cardArtOnly)).toBe(true);
    expect(commandsSupported(['listCardArtRules', 'reportList'], cardArtOnly)).toBe(false);
    expect(commandsSupported([], v30)).toBe(true);
  });
});

describe('versionSupports', () => {
  it.each([null, undefined, '', 'unknown'])('fails closed on an unknown server version (%s)', (version) => {
    const supports = versionSupports(version);
    expect(supports(SERVER_BASELINE)).toBe(false);
    expect(supports(ServerCapability.MODERATION_TOOLS)).toBe(false);
    expect(states(IsRegistered | IsModerator | IsAdmin, supports).every(([, available]) => !available)).toBe(true);
    expect(staffHomeRoute(staffToolStates(IsRegistered | IsModerator, supports))).toBeNull();
  });

  it('accepts any recognised version for the baseline commands', () => {
    expect(versionSupports('2.9.0')(SERVER_BASELINE)).toBe(true);
    expect(v30(SERVER_BASELINE)).toBe(true);
  });
});

describe('staffToolStates', () => {
  it('gives a moderator every moderator tool on a 3.1 server', () => {
    expect(states(MODERATOR, v31)).toEqual([
      ['reports', true], ['moderation', true], ['logs', true], ['administration', true], ['cardArtRules', true],
    ]);
  });

  it('keeps Moderation, Logs and Administration working on a 3.0 server and marks the 3.1-only tools', () => {
    expect(states(MODERATOR, v30)).toEqual([
      ['reports', false], ['moderation', true], ['logs', true], ['administration', true], ['cardArtRules', false],
    ]);
    expect(states(ADMIN, v30)).toEqual(states(MODERATOR, v30));
  });

  it('gives a developer who is not a moderator Logs and Developer, both through 3.1 developer commands', () => {
    expect(states(IsRegistered | IsDeveloper, v31)).toEqual([['logs', true], ['developer', true]]);
    expect(states(IsRegistered | IsDeveloper, v30)).toEqual([['logs', false], ['developer', false]]);
  });

  it('lets a moderator who is also a developer read logs through the moderator command on 3.0', () => {
    expect(states(MODERATOR | IsDeveloper, v30)).toContainEqual(['logs', true]);
  });

  it('gives judges and plain users nothing, as desktop TabSupervisor does', () => {
    expect(states(IsRegistered, v31)).toEqual([]);
    expect(states(IsRegistered | IsJudge, v31)).toEqual([]);
  });
});

describe('isStaff and staffHomeRoute', () => {
  it('counts moderators and developers as staff, not judges', () => {
    expect(isStaff(MODERATOR)).toBe(true);
    expect(isStaff(IsRegistered | IsDeveloper)).toBe(true);
    expect(isStaff(IsRegistered | IsJudge)).toBe(false);
    expect(isStaff(IsRegistered)).toBe(false);
  });

  it('opens the first tool that works on this server', () => {
    expect(staffHomeRoute(staffToolStates(MODERATOR, v31))).toBe(RouteEnum.REPORT_QUEUE);
    expect(staffHomeRoute(staffToolStates(MODERATOR, v30))).toBe(RouteEnum.MODERATION);
    expect(staffHomeRoute(staffToolStates(IsRegistered | IsDeveloper, v31))).toBe(RouteEnum.LOGS);
  });

  it('has no home when no tool works', () => {
    expect(staffHomeRoute(staffToolStates(IsRegistered | IsDeveloper, v30))).toBeNull();
    expect(staffHomeRoute(staffToolStates(IsRegistered, v31))).toBeNull();
  });

  it('gives every tool a distinct route', () => {
    expect(new Set(STAFF_TOOLS.map((tool) => tool.route)).size).toBe(STAFF_TOOLS.length);
  });
});
