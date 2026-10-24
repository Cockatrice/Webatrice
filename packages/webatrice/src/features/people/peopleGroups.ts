import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

export interface PersonRow {
  name: string;
  user: ServerInfo_User;
  online: boolean;
}

export interface PeopleGroups {
  onlineBuddies: PersonRow[];
  offlineBuddies: PersonRow[];
  othersOnline: PersonRow[];
  ignored: PersonRow[];
}

type UserMap = Readonly<Record<string, ServerInfo_User>>;

export interface PeopleGroupsInput {
  buddyList: UserMap;
  ignoreList: UserMap;
  onlineUsers: UserMap;
  selfName: string | null;
  locale?: string;
}

export function byName(locale?: string): (a: PersonRow, b: PersonRow) => number {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return (a, b) => collator.compare(a.name, b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
}

const row = (listed: ServerInfo_User, onlineUsers: UserMap): PersonRow => {
  const online = onlineUsers[listed.name];
  return { name: listed.name, user: online ?? listed, online: Boolean(online) };
};

export function groupPeople({ buddyList, ignoreList, onlineUsers, selfName, locale }: PeopleGroupsInput): PeopleGroups {
  const compare = byName(locale);
  const buddies = Object.values(buddyList).map((user) => row(user, onlineUsers));
  const othersOnline = Object.values(onlineUsers)
    .filter((user) => user.name !== selfName && !buddyList[user.name] && !ignoreList[user.name])
    .map((user) => row(user, onlineUsers));
  return {
    onlineBuddies: buddies.filter((person) => person.online).sort(compare),
    offlineBuddies: buddies.filter((person) => !person.online).sort(compare),
    othersOnline: othersOnline.sort(compare),
    ignored: Object.values(ignoreList).map((user) => row(user, onlineUsers)).sort(compare),
  };
}

export function filterGroups(groups: PeopleGroups, query: string): PeopleGroups {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return groups;
  }
  const keep = (rows: PersonRow[]) => rows.filter((person) => person.name.toLowerCase().includes(needle));
  return {
    onlineBuddies: keep(groups.onlineBuddies),
    offlineBuddies: keep(groups.offlineBuddies),
    othersOnline: keep(groups.othersOnline),
    ignored: keep(groups.ignored),
  };
}
