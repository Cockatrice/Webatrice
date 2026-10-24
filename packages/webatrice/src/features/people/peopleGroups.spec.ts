import { makeUser } from '../../__test-utils__';
import { filterGroups, groupPeople } from './peopleGroups';

const users = (...names: string[]) => Object.fromEntries(names.map((name) => [name, makeUser({ name })]));
const names = (rows: { name: string }[]) => rows.map((row) => row.name);

describe('groupPeople', () => {
  it('splits buddies by presence and lists everyone else online, each group A-Z', () => {
    const groups = groupPeople({
      buddyList: users('zed', 'Bea', 'carl', 'anna'),
      ignoreList: {},
      onlineUsers: users('zed', 'anna', 'Mia', 'liam', 'Bob'),
      selfName: null,
    });
    expect(names(groups.onlineBuddies)).toEqual(['anna', 'zed']);
    expect(names(groups.offlineBuddies)).toEqual(['Bea', 'carl']);
    expect(names(groups.othersOnline)).toEqual(['Bob', 'liam', 'Mia']);
  });

  it('ignores user level when sorting', () => {
    const groups = groupPeople({
      buddyList: { bob: makeUser({ name: 'bob', userLevel: 1 }), alice: makeUser({ name: 'alice', userLevel: 1 }) },
      ignoreList: {},
      onlineUsers: { bob: makeUser({ name: 'bob', userLevel: 15 }), alice: makeUser({ name: 'alice', userLevel: 1 }) },
      selfName: null,
    });
    expect(names(groups.onlineBuddies)).toEqual(['alice', 'bob']);
  });

  it('marks presence and prefers the live online record for online buddies', () => {
    const groups = groupPeople({
      buddyList: { amy: makeUser({ name: 'amy', country: 'de' }), ben: makeUser({ name: 'ben' }) },
      ignoreList: {},
      onlineUsers: { amy: makeUser({ name: 'amy', country: 'fr' }) },
      selfName: null,
    });
    expect(groups.onlineBuddies[0]).toMatchObject({ name: 'amy', online: true, user: { country: 'fr' } });
    expect(groups.offlineBuddies[0]).toMatchObject({ name: 'ben', online: false });
  });

  it('leaves yourself and ignored users out of the others online', () => {
    const groups = groupPeople({
      buddyList: {},
      ignoreList: users('troll', 'gone'),
      onlineUsers: users('me', 'troll', 'kim'),
      selfName: 'me',
    });
    expect(names(groups.othersOnline)).toEqual(['kim']);
    expect(groups.ignored.map(({ name, online }) => [name, online])).toEqual([['gone', false], ['troll', true]]);
  });

  it('keeps a stable order for names that differ only by case', () => {
    const groups = groupPeople({ buddyList: {}, ignoreList: {}, onlineUsers: users('kim', 'Kim'), selfName: null });
    expect(names(groups.othersOnline)).toEqual(['Kim', 'kim']);
  });
});

describe('filterGroups', () => {
  const groups = groupPeople({
    buddyList: users('Kira', 'Kess', 'Mei'),
    ignoreList: users('troll'),
    onlineUsers: users('Kira', 'kim', 'troll'),
    selfName: null,
  });

  it('keeps every group as is for an empty query', () => {
    expect(filterGroups(groups, '  ')).toBe(groups);
  });

  it('matches names case-insensitively in every group', () => {
    const found = filterGroups(groups, 'KI');
    expect(names(found.onlineBuddies)).toEqual(['Kira']);
    expect(names(found.offlineBuddies)).toEqual([]);
    expect(names(found.othersOnline)).toEqual(['kim']);
    expect(names(filterGroups(groups, 'rol').ignored)).toEqual(['troll']);
  });
});
