import type { Room } from '@cockatrice/datatrice';
import { PlayBadgeMode, PREFERENCE_DEFAULTS, RouteEnum } from '@app/types';

import { NAV_PLACES, placeBadges, placeForPath, playPath, railPlaces } from './navPlaces';

const joined = (...roomIds: number[]) => roomIds.map((roomId) => ({ info: { roomId } }) as Room);

describe('NAV_PLACES', () => {
  it('lists the fixed places, Play, Decks, Replays, People and Settings, in rail order', () => {
    expect(NAV_PLACES.map(({ key, to }) => [key, to])).toEqual([
      ['play', RouteEnum.SERVER],
      ['decks', RouteEnum.DECKS],
      ['replays', RouteEnum.REPLAYS],
      ['people', RouteEnum.PEOPLE],
      ['settings', RouteEnum.SETTINGS],
    ]);
  });
});

describe('placeForPath', () => {
  it.each([
    ['/room/3', 'play'],
    ['/game/12', 'play'],
    ['/decks', 'decks'],
    ['/deck/4', 'decks'],
    ['/deck/draft/abc', 'decks'],
    ['/decks/public/bob', 'decks'],
    ['/replays', 'replays'],
    ['/replay/k1', 'replays'],
    ['/people', 'people'],
    ['/player/bob', 'people'],
    ['/settings', 'settings'],
  ])('lights %s as %s', (path, place) => {
    expect(placeForPath(path)).toBe(place);
  });

  it('lights Staff for every staff page', () => {
    ['/report-queue', '/moderation', '/logs', '/administration', '/card-art-rules', '/developer'].forEach((path) => {
      expect([path, placeForPath(path)]).toEqual([path, 'staff']);
    });
  });

  it('lights nothing for Home or account pages', () => {
    expect(placeForPath('/server')).toBeNull();
    expect(placeForPath('/account')).toBeNull();
    expect(placeForPath('/shortcuts')).toBeNull();
  });
});

describe('railPlaces', () => {
  it('is the fixed places without a staff home', () => {
    expect(railPlaces(null).map(({ key }) => key)).toEqual(['play', 'decks', 'replays', 'people', 'settings']);
  });

  it('puts Staff before Settings, opening the staff home', () => {
    const places = railPlaces(RouteEnum.MODERATION);
    expect(places.map(({ key }) => key)).toEqual(['play', 'decks', 'replays', 'people', 'staff', 'settings']);
    expect(places.find(({ key }) => key === 'staff')?.to).toBe(RouteEnum.MODERATION);
  });

  it('points Play at the given room', () => {
    expect(railPlaces(null, '/room/2').find(({ key }) => key === 'play')?.to).toBe('/room/2');
  });
});

describe('playPath', () => {
  it('opens the last room while it is still joined', () => {
    expect(playPath(3, joined(1, 3))).toBe('/room/3');
  });

  it('opens another joined room once the last room is left', () => {
    expect(playPath(3, joined(1, 2))).toBe('/room/1');
    expect(playPath(null, joined(2))).toBe('/room/2');
  });

  it('opens Home with no room joined', () => {
    expect(playPath(3, [])).toBe(RouteEnum.SERVER);
  });
});

describe('placeBadges', () => {
  const counts = {
    rooms: { 1: 2, 4: 1 },
    games: { 7: 3 },
    chats: { bob: 1, ann: 2 },
    mentions: { rooms: { 4: 1 }, games: { 7: 1 } },
  };

  it('counts only mentions in rooms and games on Play by default, and chats on People', () => {
    expect(placeBadges(counts, PREFERENCE_DEFAULTS.playBadge)).toEqual({ play: 2, people: 3 });
  });

  it('counts all room and game activity on Play when asked to', () => {
    expect(placeBadges(counts, PlayBadgeMode.All)).toEqual({ play: 6, people: 3 });
  });

  it('is zero with nothing unread', () => {
    const none = { rooms: {}, games: {}, chats: {}, mentions: { rooms: {}, games: {} } };
    expect(placeBadges(none, PlayBadgeMode.Mentions)).toEqual({ play: 0, people: 0 });
    expect(placeBadges(none, PlayBadgeMode.All)).toEqual({ play: 0, people: 0 });
  });

  it('badges Staff with the unresolved reports once the queue is loaded', () => {
    const none = { rooms: {}, games: {}, chats: {}, mentions: { rooms: {}, games: {} } };
    expect(placeBadges(none, PlayBadgeMode.Mentions, 4)).toEqual({ play: 0, people: 0, staff: 4 });
    expect(placeBadges(none, PlayBadgeMode.Mentions, 0)).toEqual({ play: 0, people: 0 });
    expect(placeBadges(none, PlayBadgeMode.Mentions, null)).toEqual({ play: 0, people: 0 });
  });
});
