import { ServerInfo_User_UserLevelFlag as Level } from '@cockatrice/sockatrice/generated';
import { RouteEnum } from '@app/types';

import { STAFF_TOOLS } from '../staff/staffTools';
import {
  accountRole, isAdmin, isModerator, STAFF_MENU_LABEL_KEYS, USER_MENU_ENTRIES, UserMenuDialog, visibleUserMenuEntries,
} from './userMenuEntries';

const routes = (userLevel: number) => visibleUserMenuEntries(userLevel).flatMap((entry) => entry.route ?? []);
const dialogs = (userLevel: number) => visibleUserMenuEntries(userLevel).flatMap((entry) => entry.dialog ?? []);
const registered = Level.IsUser | Level.IsRegistered;

describe('userMenuEntries', () => {
  it('offers Account, Shortcuts and My Reports to every signed-in user, leaving Settings to the rail', () => {
    expect(routes(registered)).toEqual([RouteEnum.ACCOUNT, RouteEnum.SHORTCUTS, RouteEnum.MY_REPORTS]);
  });

  it('keeps staff pages out of the entry table, since the staff tool table drives them', () => {
    const staffRoutes = STAFF_TOOLS.map((tool) => tool.route);
    expect(USER_MENU_ENTRIES.filter((entry) => entry.route && staffRoutes.includes(entry.route))).toEqual([]);
    expect(USER_MENU_ENTRIES.filter((entry) => entry.dialog).every((entry) => entry.section === 'tools')).toBe(true);
  });

  it('labels every staff tool with its tab title', () => {
    STAFF_TOOLS.forEach((tool) => expect(STAFF_MENU_LABEL_KEYS[tool.id]).toMatch(/^UserMenu\./));
  });

  it('offers card import and the debug log to every signed-in user', () => {
    expect(dialogs(registered)).toEqual([UserMenuDialog.CardImport, UserMenuDialog.DebugLog]);
  });

  it('reads user-level flags as a bitmask', () => {
    expect(isModerator(Level.IsModerator | Level.IsAdmin)).toBe(true);
    expect(isAdmin(Level.IsModerator)).toBe(false);
    expect(isAdmin(Level.IsAdmin)).toBe(true);
  });

  it('gives every entry a namespaced label and a distinct destination', () => {
    const destinations = USER_MENU_ENTRIES.map((entry) => entry.route ?? entry.dialog);
    expect(new Set(destinations).size).toBe(destinations.length);
    USER_MENU_ENTRIES.forEach((entry) => expect(entry.label).toMatch(/^UserMenu\./));
  });
});

describe('userMenuEntries: reports', () => {
  const reportRoutes = (userLevel: number, supports: (capability: string) => boolean) =>
    visibleUserMenuEntries(userLevel, supports).flatMap((entry) => (entry.route === RouteEnum.MY_REPORTS ? [entry.route] : []));

  it('offers My Reports to every user on a 3.1 server and not on 3.0', () => {
    expect(reportRoutes(registered, () => true)).toEqual([RouteEnum.MY_REPORTS]);
    expect(reportRoutes(registered | Level.IsModerator, () => false)).toEqual([]);
  });
});

describe('accountRole', () => {
  it('names the highest role first', () => {
    expect(accountRole(registered | Level.IsModerator | Level.IsAdmin)).toBe('admin');
    expect(accountRole(registered | Level.IsModerator)).toBe('moderator');
    expect(accountRole(registered | Level.IsJudge)).toBe('judge');
  });

  it('tells registered users from guests', () => {
    expect(accountRole(registered)).toBe('registered');
    expect(accountRole(Level.IsUser)).toBe('unregistered');
  });
});
