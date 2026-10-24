import { useMemo, useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { server } from '@cockatrice/datatrice';
import { ServerInfo_User_UserLevelFlag } from '@cockatrice/sockatrice/generated';
import { useGameInvite } from '@app/feature-widgets/game-invite';
import { useLiveServerEndpoint } from '@app/feature-widgets/known-hosts';
import { useCanOverrideGameRestrictions, useOpenChat, useUnreadCounts } from '@app/hooks';
import { useAppSelector } from '@app/store';

import { rowAction, type Activity, type RowAction } from './buddyActivity';
import { myOpenGame, type MyOpenGame } from './myOpenGame';
import { filterGroups, groupPeople, type PeopleGroups, type PersonRow } from './peopleGroups';
import { useBuddyPresence } from './useBuddyPresence';
import { useJoinFriendGame, type JoinFriendGame } from './useJoinFriendGame';

export interface OnlineBuddy extends PersonRow {
  activity: Activity;
  action: RowAction;
  unread: number;
}

export type PeopleSection = 'offline' | 'others' | 'ignored';

export type InviteHint = 'buddies' | 'others' | 'noLink';

export interface People extends Omit<PeopleGroups, 'onlineBuddies'> {
  query: string;
  setQuery: (query: string) => void;
  searching: boolean;
  nothingMatches: boolean;
  isOpen: (section: PeopleSection) => boolean;
  toggle: (section: PeopleSection) => void;
  inviteHint: InviteHint;
  onlineBuddies: OnlineBuddy[];
  totals: { online: number; buddies: number; others: number; ignored: number };
  myGame: MyOpenGame | null;
  canInvite: boolean;
  canEditLists: boolean;
  canAddQuery: boolean;
  unread: Readonly<Record<string, number>>;
  joinFlow: JoinFriendGame;
  openChat: (name: string) => void;
  invite: (name: string) => void;
  addBuddy: (name: string) => void;
  removeBuddy: (name: string) => void;
  addIgnore: (name: string) => void;
  removeIgnore: (name: string) => void;
}

export function usePeople(): People {
  const webClient = useWebClient();
  const openChat = useOpenChat();
  const self = useAppSelector(server.Selectors.getUser);
  const users = useAppSelector(server.Selectors.getUsers);
  const buddyMap = useAppSelector(server.Selectors.getBuddyList);
  const ignoreMap = useAppSelector(server.Selectors.getIgnoreList);
  const locale = useAppSelector((state) => state.server.locale);
  const joinedGames = useAppSelector((state) => state.games.games);
  const overrideRestrictions = useCanOverrideGameRestrictions();
  const unread = useUnreadCounts((counts) => counts.chats);
  const joinFlow = useJoinFriendGame();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<PeopleSection, boolean>>({ offline: false, others: false, ignored: false });
  const selfName = self?.name ?? null;

  const groups = useMemo(
    () => groupPeople({ buddyList: buddyMap, ignoreList: ignoreMap, onlineUsers: users, selfName, locale }),
    [buddyMap, ignoreMap, users, selfName, locale],
  );
  const onlineNames = useMemo(() => groups.onlineBuddies.map((person) => person.name), [groups.onlineBuddies]);
  const activities = useBuddyPresence(onlineNames);
  const myGame = useMemo(() => myOpenGame(joinedGames), [joinedGames]);
  const gameInvite = useGameInvite(myGame?.gameId ?? -1, useLiveServerEndpoint());
  const canInvite = myGame !== null && gameInvite.link !== null;

  const visible = useMemo(() => filterGroups(groups, query), [groups, query]);
  const onlineBuddies = useMemo(() => visible.onlineBuddies.map((person) => {
    const activity = activities[person.name] ?? { kind: 'unknown' as const };
    return { ...person, activity, action: rowAction(activity, canInvite, overrideRestrictions), unread: unread[person.name] ?? 0 };
  }), [visible.onlineBuddies, activities, canInvite, overrideRestrictions, unread]);

  const canEditLists = ((self?.userLevel ?? 0) & ServerInfo_User_UserLevelFlag.IsRegistered) !== 0;
  const trimmed = query.trim();
  const searching = trimmed !== '';
  const session = webClient.request.session;
  return {
    query,
    setQuery,
    searching,
    nothingMatches: searching && onlineBuddies.length === 0 && visible.offlineBuddies.length === 0
      && visible.othersOnline.length === 0 && visible.ignored.length === 0,
    isOpen: (section) => searching || open[section],
    toggle: (section) => setOpen((current) => ({ ...current, [section]: !current[section] })),
    inviteHint: !canInvite ? 'noLink' : groups.onlineBuddies.length > 0 ? 'buddies' : 'others',
    onlineBuddies,
    offlineBuddies: visible.offlineBuddies,
    othersOnline: visible.othersOnline,
    ignored: visible.ignored,
    totals: {
      online: groups.onlineBuddies.length,
      buddies: groups.onlineBuddies.length + groups.offlineBuddies.length,
      others: groups.othersOnline.length,
      ignored: groups.ignored.length,
    },
    myGame,
    canInvite,
    canEditLists,
    canAddQuery: canEditLists && trimmed !== '' && trimmed !== selfName && !buddyMap[trimmed],
    unread,
    joinFlow,
    openChat,
    invite: gameInvite.sendInvite,
    addBuddy: (name) => session.addToBuddyList(name),
    removeBuddy: (name) => session.removeFromBuddyList(name),
    addIgnore: (name) => session.addToIgnoreList(name),
    removeIgnore: (name) => session.removeFromIgnoreList(name),
  };
}
