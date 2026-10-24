import { generatePath, matchPath } from 'react-router-dom';
import { Film, Library, Settings, ShieldCheck, Swords, Users, type LucideIcon } from 'lucide-react';

import type { Room } from '@cockatrice/datatrice';
import type { MentionCounts } from '@app/services';
import { PlayBadgeMode, RouteEnum } from '@app/types';

import { STAFF_ROUTES } from '../staff/staffTools';
import type { TabUnreadCounts } from './topBarTabs';

export type PlaceKey = 'play' | 'decks' | 'replays' | 'people' | 'staff' | 'settings';

export const PLACE_LABEL_KEYS: Record<PlaceKey, string> = {
  play: 'NavRail.place.play',
  decks: 'NavRail.place.decks',
  replays: 'NavRail.place.replays',
  people: 'NavRail.place.people',
  staff: 'NavRail.place.staff',
  settings: 'NavRail.place.settings',
};

export interface NavPlace {
  key: PlaceKey;
  icon: LucideIcon;
  to: string;
}

export const NAV_PLACES: readonly NavPlace[] = [
  { key: 'play', icon: Swords, to: RouteEnum.SERVER },
  { key: 'decks', icon: Library, to: RouteEnum.DECKS },
  { key: 'replays', icon: Film, to: RouteEnum.REPLAYS },
  { key: 'people', icon: Users, to: RouteEnum.PEOPLE },
  { key: 'settings', icon: Settings, to: RouteEnum.SETTINGS },
];

export function playPath(lastRoomId: number | null, joinedRooms: readonly Room[]): string {
  const room = joinedRooms.find(({ info }) => info.roomId === lastRoomId) ?? joinedRooms[0];
  return room ? generatePath(RouteEnum.ROOM, { roomId: String(room.info.roomId) }) : RouteEnum.SERVER;
}

export function railPlaces(staffHome: RouteEnum | null, play: string = RouteEnum.SERVER): NavPlace[] {
  const places = NAV_PLACES.map((place) => (place.key === 'play' ? { ...place, to: play } : place));
  if (staffHome === null) {
    return places;
  }
  const staff: NavPlace = { key: 'staff', icon: ShieldCheck, to: staffHome };
  return places.flatMap((place) => (place.key === 'settings' ? [staff, place] : [place]));
}

const PLACE_ROUTES: readonly [PlaceKey, readonly RouteEnum[]][] = [
  ['play', [RouteEnum.ROOM, RouteEnum.GAME]],
  ['decks', [RouteEnum.DECKS, RouteEnum.DECK, RouteEnum.DECK_DRAFT, RouteEnum.SHARED_DECK, RouteEnum.PUBLIC_DECKS]],
  ['replays', [RouteEnum.REPLAYS, RouteEnum.REPLAY]],
  ['people', [RouteEnum.PEOPLE, RouteEnum.PLAYER]],
  ['staff', STAFF_ROUTES],
  ['settings', [RouteEnum.SETTINGS]],
];

export function placeForPath(pathname: string): PlaceKey | null {
  const found = PLACE_ROUTES.find(([, routes]) => routes.some((path) => matchPath({ path, end: true }, pathname)));
  return found ? found[0] : null;
}

const sum = (counts: Readonly<Record<string | number, number>>) =>
  Object.values(counts).reduce((total, n) => total + n, 0);

export interface PlaceBadgeCounts extends TabUnreadCounts {
  chats: Readonly<Record<string, number>>;
  mentions: MentionCounts;
}

export function placeBadges(
  counts: PlaceBadgeCounts,
  playBadge: PlayBadgeMode,
  unresolvedReports: number | null = null,
): Partial<Record<PlaceKey, number>> {
  const play = playBadge === PlayBadgeMode.All ? counts : counts.mentions;
  return {
    play: sum(play.rooms) + sum(play.games),
    people: sum(counts.chats),
    ...(unresolvedReports ? { staff: unresolvedReports } : {}),
  };
}
