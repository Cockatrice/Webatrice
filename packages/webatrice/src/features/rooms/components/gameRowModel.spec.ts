import { create, type MessageInitShape } from '@bufbuild/protobuf';
import { ServerInfo_GameSchema } from '@cockatrice/sockatrice/generated';

import { gameAge, gameAvailability, gameTypeNames, restrictionKeys, rowJoinState } from './gameRowModel';

const game = (overrides: MessageInitShape<typeof ServerInfo_GameSchema> = {}) =>
  create(ServerInfo_GameSchema, { gameId: 1, playerCount: 1, maxPlayers: 4, spectatorsAllowed: true, ...overrides });

const plain = { override: false, pending: false, alreadyJoined: false };

describe('gameAvailability', () => {
  it.each([
    ['started', { started: true, withPassword: true }],
    ['full', { playerCount: 4, withPassword: true }],
    ['password', { withPassword: true, onlyBuddies: true }],
    ['buddies', { onlyBuddies: true }],
    ['open', {}],
  ] as const)('reads %s first', (expected, overrides) => {
    expect(gameAvailability(game(overrides))).toBe(expected);
  });
});

describe('rowJoinState', () => {
  it('blocks joining a full or started game and says why', () => {
    expect(rowJoinState(game({ playerCount: 4 }), plain)).toMatchObject({ canJoin: false, joinBlock: 'full', canSpectate: true });
    expect(rowJoinState(game({ started: true }), plain)).toMatchObject({ canJoin: false, joinBlock: 'started' });
  });

  it('lets staff overrides and games you are already in through', () => {
    const closed = game({ playerCount: 4, spectatorsAllowed: false, withPassword: true });
    expect(rowJoinState(closed, { ...plain, override: true })).toMatchObject({
      canJoin: true, canSpectate: true, joinNeedsPassword: false,
    });
    expect(rowJoinState(closed, { ...plain, alreadyJoined: true })).toMatchObject({ canJoin: true, canSpectate: true });
  });

  it('blocks both actions while a join is pending', () => {
    expect(rowJoinState(game(), { ...plain, pending: true })).toMatchObject({
      canJoin: false, joinBlock: 'pending', canSpectate: false, spectateBlock: 'pending',
    });
  });

  it('blocks spectating when the game allows no spectators', () => {
    expect(rowJoinState(game({ spectatorsAllowed: false }), plain)).toMatchObject({ canSpectate: false, spectateBlock: 'notAllowed' });
  });

  it('asks spectators for the password only when the game says they need it', () => {
    expect(rowJoinState(game({ withPassword: true }), plain)).toMatchObject({ joinNeedsPassword: true, spectateNeedsPassword: false });
    expect(rowJoinState(game({ withPassword: true, spectatorsNeedPassword: true }), plain).spectateNeedsPassword).toBe(true);
  });
});

describe('restrictionKeys', () => {
  it('lists the joining rules other than the password', () => {
    expect(restrictionKeys(game({ withPassword: true, onlyBuddies: true, onlyRegistered: true, shareDecklistsOnLoad: true })))
      .toEqual(['buddiesOnly', 'registeredOnly', 'openDecklists']);
    expect(restrictionKeys(game())).toEqual([]);
  });
});

describe('gameAge', () => {
  it('turns the start time into minutes or hours', () => {
    expect(gameAge(1000, 1030)).toEqual({ unit: 'new' });
    expect(gameAge(1000, 1000 + 5 * 60 + 59)).toEqual({ unit: 'minutes', count: 5 });
    expect(gameAge(1000, 1000 + 125 * 60)).toEqual({ unit: 'hours', count: 2 });
  });

  it('never goes negative when the server clock is ahead', () => {
    expect(gameAge(2000, 1000)).toEqual({ unit: 'new' });
  });
});

describe('gameTypeNames', () => {
  it('names each known game type once', () => {
    expect(gameTypeNames(game({ gameTypes: [1, 1, 2, 9] }), { 1: 'Commander', 2: 'Modern' })).toEqual(['Commander', 'Modern']);
  });
});
