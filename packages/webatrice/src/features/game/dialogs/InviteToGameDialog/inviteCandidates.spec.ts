import { create } from '@bufbuild/protobuf';
import { ServerInfo_UserSchema, type ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { buildInviteRows } from './inviteCandidates';

const usersOf = (...names: string[]): Record<string, ServerInfo_User> =>
  Object.fromEntries(names.map((name) => [name, create(ServerInfo_UserSchema, { name })]));

const base = {
  users: usersOf('me', 'alice', 'Bob', 'carol', 'dave', 'troll'),
  buddyList: usersOf('carol', 'zed'),
  ignoreList: usersOf('troll'),
  excludeNames: new Set(['me', 'dave']),
  onlyBuddies: false,
  search: '',
};

describe('buildInviteRows', () => {
  it('lists online buddies first, then other online users, without self/participants/ignored', () => {
    expect(buildInviteRows(base)).toEqual([
      { kind: 'header', section: 'buddies' },
      { kind: 'user', name: 'carol' },
      { kind: 'header', section: 'online' },
      { kind: 'user', name: 'alice' },
      { kind: 'user', name: 'Bob' },
    ]);
  });

  it('only lists buddies for a buddies-only game, and never offline buddies', () => {
    expect(buildInviteRows({ ...base, onlyBuddies: true })).toEqual([
      { kind: 'header', section: 'buddies' },
      { kind: 'user', name: 'carol' },
    ]);
  });

  it('filters by a case-insensitive search and drops empty sections', () => {
    expect(buildInviteRows({ ...base, search: 'BO' })).toEqual([
      { kind: 'header', section: 'online' },
      { kind: 'user', name: 'Bob' },
    ]);
    expect(buildInviteRows({ ...base, search: 'nobody' })).toEqual([]);
  });
});
