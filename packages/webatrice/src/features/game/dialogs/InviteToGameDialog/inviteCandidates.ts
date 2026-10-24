import type { ServerInfo_User } from '@cockatrice/sockatrice/generated';

export type InviteRow =
  | { kind: 'header'; section: 'buddies' | 'online' }
  | { kind: 'user'; name: string };

export interface InviteCandidateInput {
  users: Record<string, ServerInfo_User>;
  buddyList: Record<string, ServerInfo_User>;
  ignoreList: Record<string, ServerInfo_User>;
  excludeNames: ReadonlySet<string>;
  onlyBuddies: boolean;
  search: string;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

export function buildInviteRows({
  users,
  buddyList,
  ignoreList,
  excludeNames,
  onlyBuddies,
  search,
}: InviteCandidateInput): InviteRow[] {
  const needle = search.trim().toLowerCase();
  const buddies: string[] = [];
  const online: string[] = [];
  for (const name of Object.keys(users)) {
    if (excludeNames.has(name) || ignoreList[name]) {
      continue;
    }
    if (needle && !name.toLowerCase().includes(needle)) {
      continue;
    }
    if (buddyList[name]) {
      buddies.push(name);
    } else if (!onlyBuddies) {
      online.push(name);
    }
  }

  const rows: InviteRow[] = [];
  if (buddies.length > 0) {
    rows.push({ kind: 'header', section: 'buddies' });
    rows.push(...buddies.sort(byName).map((name): InviteRow => ({ kind: 'user', name })));
  }
  if (online.length > 0) {
    rows.push({ kind: 'header', section: 'online' });
    rows.push(...online.sort(byName).map((name): InviteRow => ({ kind: 'user', name })));
  }
  return rows;
}
