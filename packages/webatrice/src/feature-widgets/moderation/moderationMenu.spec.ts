import { ServerInfo_User_UserLevelFlag as Flag } from '@cockatrice/sockatrice/generated';

import { buildModerationMenu, type ModerationMenuGroups } from './moderationMenu';

const REGULAR = Flag.IsUser | Flag.IsRegistered;
const MODERATOR = REGULAR | Flag.IsModerator;
const ADMIN = MODERATOR | Flag.IsAdmin;
const UNREGISTERED = Flag.IsUser;
const ON_3_1 = { supportsDeveloperRole: true };

const actions = (groups: ModerationMenuGroups) => groups.map((group) => group.map((entry) => entry.action));

describe('buildModerationMenu', () => {
  it('offers nothing to a regular user', () => {
    expect(buildModerationMenu({ localUserLevel: REGULAR, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1 })).toEqual([]);
  });

  it('gives a developer without moderator rights nothing', () => {
    const developer = REGULAR | Flag.IsDeveloper;
    expect(buildModerationMenu({ localUserLevel: developer, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1 })).toEqual([]);
  });

  it('offers nothing to an unregistered user', () => {
    expect(buildModerationMenu({ localUserLevel: UNREGISTERED, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1 })).toEqual([]);
  });

  it('gives a moderator warn, ban and admin-notes groups in desktop order, without role changes', () => {
    const groups = buildModerationMenu({ localUserLevel: MODERATOR, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1 });
    expect(actions(groups)).toEqual([
      ['warnUser', 'warnHistory'],
      ['banUser', 'banHistory'],
      ['adminNotes'],
    ]);
    expect(groups.flat().every((entry) => !entry.disabled)).toBe(true);
  });

  it('gives an admin promote entries for a registered regular user', () => {
    const groups = buildModerationMenu({ localUserLevel: ADMIN, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1 });
    expect(actions(groups).at(-1)).toEqual(['promoteMod', 'promoteJudge', 'promoteDeveloper']);
  });

  it('gives an admin demote entries for a moderator judge developer', () => {
    const groups = buildModerationMenu({
      localUserLevel: ADMIN,
      targetUserLevel: MODERATOR | Flag.IsJudge | Flag.IsDeveloper,
      isSelf: false,
      ...ON_3_1,
    });
    expect(actions(groups).at(-1)).toEqual(['demoteMod', 'demoteJudge', 'demoteDeveloper']);
  });

  it('mixes demote and promote per role', () => {
    const groups = buildModerationMenu({ localUserLevel: ADMIN, targetUserLevel: REGULAR | Flag.IsJudge, isSelf: false, ...ON_3_1 });
    expect(actions(groups).at(-1)).toEqual(['promoteMod', 'demoteJudge', 'promoteDeveloper']);
  });

  it('offers no developer entries on a 3.0 server, which ignores the developer flag', () => {
    const promote = buildModerationMenu({ localUserLevel: ADMIN, targetUserLevel: REGULAR, isSelf: false, supportsDeveloperRole: false });
    expect(actions(promote).at(-1)).toEqual(['promoteMod', 'promoteJudge']);
    const demote = buildModerationMenu({
      localUserLevel: ADMIN,
      targetUserLevel: MODERATOR | Flag.IsJudge | Flag.IsDeveloper,
      isSelf: false,
      supportsDeveloperRole: false,
    });
    expect(actions(demote).at(-1)).toEqual(['demoteMod', 'demoteJudge']);
  });

  it('offers no role changes for an unregistered target', () => {
    const groups = buildModerationMenu({ localUserLevel: ADMIN, targetUserLevel: UNREGISTERED, isSelf: false, ...ON_3_1 });
    expect(actions(groups)).toHaveLength(3);
  });

  it('offers no role changes when the target level is unknown', () => {
    const groups = buildModerationMenu({ localUserLevel: ADMIN, targetUserLevel: 0, isSelf: false, ...ON_3_1 });
    expect(actions(groups)).toHaveLength(3);
  });

  it.each([
    ['moderator', MODERATOR],
    ['admin', ADMIN],
  ])('keeps every entry visible but disabled when a %s targets themselves', (_role, level) => {
    const groups = buildModerationMenu({ localUserLevel: level, targetUserLevel: level, isSelf: true, ...ON_3_1 });
    expect(groups.flat().length).toBeGreaterThan(0);
    expect(groups.flat().every((entry) => entry.disabled)).toBe(true);
  });
});

describe('buildModerationMenu: investigate and the admin lock', () => {
  it('adds "Investigate user" after admin notes on a server with the moderation tools', () => {
    const groups = buildModerationMenu({
      localUserLevel: MODERATOR, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1, canInvestigate: true,
    });
    expect(actions(groups)[2]).toEqual(['adminNotes', 'investigateUser']);
  });

  it('keeps "Investigate user" disabled on yourself, as desktop enables it only for another user', () => {
    const groups = buildModerationMenu({
      localUserLevel: MODERATOR, targetUserLevel: MODERATOR, isSelf: true, ...ON_3_1, canInvestigate: true,
    });
    expect(groups[2].find((entry) => entry.action === 'investigateUser')?.disabled).toBe(true);
  });

  it('hides the whole section while the Administration lock is on', () => {
    expect(buildModerationMenu({
      localUserLevel: ADMIN, targetUserLevel: REGULAR, isSelf: false, ...ON_3_1, adminLocked: true,
    })).toEqual([]);
  });
});
