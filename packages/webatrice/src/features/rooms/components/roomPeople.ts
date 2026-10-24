import type { Game } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag, type ServerInfo_User } from '@cockatrice/sockatrice/generated';

export type PeopleSection = 'buddies' | 'offline' | 'staff' | 'everyone';

export type SectionOpen = Record<PeopleSection, boolean>;

export const DEFAULT_SECTION_OPEN: SectionOpen = { buddies: true, offline: false, staff: true, everyone: false };

export interface BuddyEntry {
  user: ServerInfo_User;
  inRoom: boolean;
  hosting?: Game;
}

export interface RoomPeople {
  memberCount: number;
  buddies: BuddyEntry[];
  offlineBuddies: ServerInfo_User[];
  staff: ServerInfo_User[];
  everyone: ServerInfo_User[];
}

export interface RoomPeopleInput {
  roomUsers: Readonly<Record<string, ServerInfo_User>>;
  buddyList: Readonly<Record<string, ServerInfo_User>>;
  onlineUsers: Readonly<Record<string, ServerInfo_User>>;
  games: Readonly<Record<number, Game>>;
  query?: string;
  locale?: string;
}

const STAFF_BITS =
  ServerInfo_User_UserLevelFlag.IsAdmin | ServerInfo_User_UserLevelFlag.IsModerator | ServerInfo_User_UserLevelFlag.IsJudge;

export function isStaff(user: ServerInfo_User): boolean {
  return (user.userLevel & STAFF_BITS) !== 0;
}

export function hostedGames(games: Readonly<Record<number, Game>>): Map<string, Game> {
  const byHost = new Map<string, Game>();
  for (const game of Object.values(games)) {
    const host = game.info.creatorInfo?.name;
    if (!host) {
      continue;
    }
    const current = byHost.get(host);
    if (!current || game.info.gameId > current.info.gameId) {
      byHost.set(host, game);
    }
  }
  return byHost;
}

export function buildRoomPeople({ roomUsers, buddyList, onlineUsers, games, query = '', locale }: RoomPeopleInput): RoomPeople {
  const needle = query.trim().toLowerCase();
  const matches = (user: ServerInfo_User) => !needle || user.name.toLowerCase().includes(needle);
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  const byName = (a: ServerInfo_User, b: ServerInfo_User) => collator.compare(a.name, b.name);
  const hosts = hostedGames(games);
  const members = Object.values(roomUsers);

  const buddies: BuddyEntry[] = [];
  const offlineBuddies: ServerInfo_User[] = [];
  for (const buddy of Object.values(buddyList)) {
    const here = roomUsers[buddy.name];
    const online = here ?? onlineUsers[buddy.name];
    const user = online ?? buddy;
    if (!matches(user)) {
      continue;
    }
    if (online) {
      buddies.push({ user, inRoom: Boolean(here), hosting: here ? hosts.get(buddy.name) : undefined });
    } else {
      offlineBuddies.push(user);
    }
  }
  buddies.sort((a, b) => Number(b.inRoom) - Number(a.inRoom) || byName(a.user, b.user));
  offlineBuddies.sort(byName);

  const everyone = members.filter(matches).sort(byName);
  return {
    memberCount: members.length,
    buddies,
    offlineBuddies,
    staff: everyone.filter(isStaff),
    everyone,
  };
}

export type PeopleRow =
  | { kind: 'section'; key: string; section: PeopleSection; open: boolean; count: number }
  | { kind: 'buddy'; key: string; entry: BuddyEntry }
  | { kind: 'person'; key: string; user: ServerInfo_User; muted?: boolean }
  | { kind: 'preview'; key: string; users: ServerInfo_User[]; more: number }
  | { kind: 'empty'; key: string; section: PeopleSection };

export const PREVIEW_FACES = 4;
export const PREVIEW_NAMES = 2;

export function peopleRows(people: RoomPeople, open: SectionOpen, searching: boolean): PeopleRow[] {
  const rows: PeopleRow[] = [];
  const isOpen = (section: PeopleSection) => searching || open[section];
  const section = (id: PeopleSection, count: number) => {
    rows.push({ kind: 'section', key: `section:${id}`, section: id, open: isOpen(id), count });
    return isOpen(id);
  };

  if (!searching || people.buddies.length > 0) {
    if (section('buddies', people.buddies.length)) {
      if (people.buddies.length === 0) {
        rows.push({ kind: 'empty', key: 'empty:buddies', section: 'buddies' });
      }
      for (const entry of people.buddies) {
        rows.push({ kind: 'buddy', key: `buddy:${entry.user.name}`, entry });
      }
    }
  }

  if (people.offlineBuddies.length > 0 && section('offline', people.offlineBuddies.length)) {
    for (const user of people.offlineBuddies) {
      rows.push({ kind: 'person', key: `offline:${user.name}`, user, muted: true });
    }
  }

  if (people.staff.length > 0 && section('staff', people.staff.length)) {
    for (const user of people.staff) {
      rows.push({ kind: 'person', key: `staff:${user.name}`, user });
    }
  }

  if (searching && people.everyone.length === 0) {
    if (rows.length === 0) {
      rows.push({ kind: 'empty', key: 'empty:search', section: 'everyone' });
    }
    return rows;
  }

  if (section('everyone', searching ? people.everyone.length : people.memberCount)) {
    for (const user of people.everyone) {
      rows.push({ kind: 'person', key: `member:${user.name}`, user });
    }
  } else if (people.everyone.length > 0) {
    rows.push({
      kind: 'preview',
      key: 'preview:everyone',
      users: people.everyone.slice(0, PREVIEW_FACES),
      more: Math.max(0, people.everyone.length - PREVIEW_NAMES),
    });
  }
  return rows;
}
