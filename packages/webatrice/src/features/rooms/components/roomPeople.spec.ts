import { create } from '@bufbuild/protobuf';
import type { Game } from '@cockatrice/datatrice';
import { ServerInfo_GameSchema, ServerInfo_User_UserLevelFlag as Level, type ServerInfo_User } from '@cockatrice/sockatrice/generated';

import { makeUser } from '../../../__test-utils__';
import { buildRoomPeople, DEFAULT_SECTION_OPEN, hostedGames, isStaff, peopleRows, type RoomPeopleInput } from './roomPeople';

const byName = (...users: ServerInfo_User[]) => Object.fromEntries(users.map((u) => [u.name, u]));
const game = (gameId: number, host: string, description = ''): Game => ({
  info: create(ServerInfo_GameSchema, { gameId, description, creatorInfo: makeUser({ name: host }) }),
  gameType: '',
});

const alice = makeUser({ name: 'alice' });
const bob = makeUser({ name: 'Bob' });
const carol = makeUser({ name: 'carol', userLevel: Level.IsUser | Level.IsRegistered | Level.IsModerator });
const dave = makeUser({ name: 'dave' });
const erin = makeUser({ name: 'erin' });

const input = (overrides: Partial<RoomPeopleInput> = {}): RoomPeopleInput => ({
  roomUsers: byName(alice, bob, carol),
  buddyList: byName(bob, dave, erin),
  onlineUsers: byName(alice, bob, carol, dave),
  games: {},
  ...overrides,
});

describe('buildRoomPeople', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['en', 'sv'])('reuses one collator across sections with stable base-sensitivity ties (%s)', (locale) => {
    const names = ['z', 'ä', 'A', 'a', 'Å', 'b'];
    const users = names.map((name) => makeUser({ name }));
    const expected = [...names].sort((a, b) => a.localeCompare(b, locale, { sensitivity: 'base' }));
    const collators = vi.spyOn(Intl, 'Collator');
    const comparisons = vi.spyOn(String.prototype, 'localeCompare');
    const people = buildRoomPeople(input({
      locale, roomUsers: byName(...users), buddyList: byName(...users), onlineUsers: {},
    }));
    expect(people.everyone.map((user) => user.name)).toEqual(expected);
    expect(people.buddies.map((entry) => entry.user.name)).toEqual(expected);
    expect(collators).toHaveBeenCalledExactlyOnceWith(locale, { sensitivity: 'base' });
    expect(comparisons).not.toHaveBeenCalled();
    collators.mockClear();
    const offline = buildRoomPeople(input({ locale, roomUsers: {}, buddyList: byName(...users), onlineUsers: {} }));
    expect(offline.offlineBuddies.map((user) => user.name)).toEqual(expected);
    expect(collators).toHaveBeenCalledTimes(1);
  });

  it('lists online buddies in this room first, then online buddies elsewhere, and offline buddies apart', () => {
    const people = buildRoomPeople(input());

    expect(people.buddies.map((b) => [b.user.name, b.inRoom])).toEqual([['Bob', true], ['dave', false]]);
    expect(people.offlineBuddies.map((u) => u.name)).toEqual(['erin']);
  });

  it('counts and lists the room members, not the whole server', () => {
    const people = buildRoomPeople(input());

    expect(people.memberCount).toBe(3);
    expect(people.everyone.map((u) => u.name)).toEqual(['alice', 'Bob', 'carol']);
  });

  it('finds staff in the room from the user level bits', () => {
    expect(buildRoomPeople(input()).staff.map((u) => u.name)).toEqual(['carol']);
    expect(isStaff(makeUser({ userLevel: Level.IsUser | Level.IsJudge }))).toBe(true);
    expect(isStaff(makeUser({ userLevel: Level.IsUser | Level.IsRegistered }))).toBe(false);
  });

  it('says which game a buddy in the room hosts, from the room game list', () => {
    const people = buildRoomPeople(input({ games: { 4: game(4, 'Bob', 'old'), 9: game(9, 'Bob', 'Bracket 3'), 5: game(5, 'dave') } }));

    expect(people.buddies[0].hosting?.info.description).toBe('Bracket 3');
    expect(people.buddies[1].hosting).toBeUndefined();
  });

  it('filters every section by name, ignoring case', () => {
    const people = buildRoomPeople(input({ query: ' BO ' }));

    expect(people.buddies.map((b) => b.user.name)).toEqual(['Bob']);
    expect(people.everyone.map((u) => u.name)).toEqual(['Bob']);
    expect(people.offlineBuddies).toEqual([]);
    expect(people.memberCount).toBe(3);
  });
});

describe('hostedGames', () => {
  it('maps each host to their newest game and skips games without a creator', () => {
    const orphan = { ...game(3, ''), info: create(ServerInfo_GameSchema, { gameId: 3 }) };
    const hosts = hostedGames({ 1: game(1, 'a'), 2: game(2, 'a'), 3: orphan });

    expect([...hosts.keys()]).toEqual(['a']);
    expect(hosts.get('a')?.info.gameId).toBe(2);
  });
});

describe('peopleRows', () => {
  const kinds = (rows: ReturnType<typeof peopleRows>) =>
    rows.map((r) => (r.kind === 'section' ? `${r.section}${r.open ? '+' : '-'}` : r.kind));

  it('folds offline buddies and everyone by default, with a preview of the room', () => {
    const rows = peopleRows(buildRoomPeople(input()), DEFAULT_SECTION_OPEN, false);

    expect(kinds(rows)).toEqual(['buddies+', 'buddy', 'buddy', 'offline-', 'staff+', 'person', 'everyone-', 'preview']);
    const preview = rows.at(-1);
    expect(preview?.kind === 'preview' && preview.more).toBe(1);
  });

  it('shows the whole room once everyone is opened', () => {
    const rows = peopleRows(buildRoomPeople(input()), { ...DEFAULT_SECTION_OPEN, everyone: true }, false);

    expect(kinds(rows).slice(-4)).toEqual(['everyone+', 'person', 'person', 'person']);
  });

  it('says so when no buddy is online', () => {
    const rows = peopleRows(buildRoomPeople(input({ buddyList: {} })), DEFAULT_SECTION_OPEN, false);

    expect(kinds(rows).slice(0, 2)).toEqual(['buddies+', 'empty']);
  });

  it('opens every matching section while searching and hides empty ones', () => {
    const rows = peopleRows(buildRoomPeople(input({ query: 'erin' })), DEFAULT_SECTION_OPEN, true);

    expect(kinds(rows)).toEqual(['offline+', 'person']);
  });

  it('reports no match when a search finds nobody', () => {
    const rows = peopleRows(buildRoomPeople(input({ query: 'zzz' })), DEFAULT_SECTION_OPEN, true);

    expect(rows.map((r) => r.kind)).toEqual(['empty']);
  });
});
