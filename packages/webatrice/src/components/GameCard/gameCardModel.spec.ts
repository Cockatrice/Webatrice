import { makeGame } from '@cockatrice/datatrice/testing';

import { gameAvailability, gameCardActions, gameRestrictions, gameTypeNames, hasOpenSeat, spectatorTraits } from './gameCardModel';

const info = (overrides: Parameters<typeof makeGame>[0] = {}) =>
  makeGame({ playerCount: 1, maxPlayers: 4, spectatorsAllowed: true, ...overrides }).info;

describe('gameAvailability', () => {
  it.each([
    ['started', { started: true, withPassword: true }],
    ['full', { playerCount: 4, withPassword: true }],
    ['password', { withPassword: true, onlyBuddies: true }],
    ['buddies', { onlyBuddies: true }],
    ['open', {}],
  ] as const)('is %s', (expected, overrides) => {
    expect(gameAvailability(info(overrides))).toBe(expected);
  });
});

describe('hasOpenSeat', () => {
  it('needs a free seat in a game that has not started', () => {
    expect(hasOpenSeat(info())).toBe(true);
    expect(hasOpenSeat(info({ playerCount: 4 }))).toBe(false);
    expect(hasOpenSeat(info({ started: true }))).toBe(false);
  });
});

describe('gameTypeNames', () => {
  it('names every game type from the room map', () => {
    const game = makeGame({ gameTypes: [2, 1], gameType: 'Legacy' });
    expect(gameTypeNames(game, { 1: 'Commander', 2: 'Legacy' })).toEqual(['Legacy', 'Commander']);
  });

  it('falls back to the stored first type, or nothing', () => {
    expect(gameTypeNames(makeGame({ gameTypes: [9], gameType: 'Modern' }), {})).toEqual(['Modern']);
    expect(gameTypeNames(makeGame(), {})).toEqual([]);
  });
});

describe('gameRestrictions', () => {
  it('leaves out what the availability badge already says', () => {
    expect(gameRestrictions(info({ withPassword: true, onlyRegistered: true }))).toEqual(['registeredOnly']);
    expect(gameRestrictions(info({ onlyBuddies: true, shareDecklistsOnLoad: true }))).toEqual(['openDecklists']);
  });

  it('keeps the password when the badge shows the game is full', () => {
    expect(gameRestrictions(info({ playerCount: 4, withPassword: true, onlyBuddies: true })))
      .toEqual(['password', 'buddiesOnly']);
  });
});

describe('spectatorTraits', () => {
  it('lists chat, hands and password in order', () => {
    expect(spectatorTraits(info({ spectatorsCanChat: true, spectatorsOmniscient: true, spectatorsNeedPassword: true })))
      .toEqual(['canChat', 'seeHands', 'password']);
  });
});

describe('gameCardActions', () => {
  it('blocks joining a started or full game but still allows spectating', () => {
    expect(gameCardActions(info({ started: true }))).toMatchObject({ canJoin: false, joinBlock: 'started', canSpectate: true });
    expect(gameCardActions(info({ playerCount: 4 }))).toMatchObject({ canJoin: false, joinBlock: 'full' });
  });

  it('lets staff overrides join a full game and spectate where spectators are off', () => {
    expect(gameCardActions(info({ playerCount: 4, spectatorsAllowed: false }), { overrideRestrictions: true }))
      .toMatchObject({ canJoin: true, canSpectate: true, joinNeedsPassword: false });
  });

  it('still blocks a started game for staff, as the server does', () => {
    expect(gameCardActions(info({ started: true }), { overrideRestrictions: true })).toMatchObject({ canJoin: false });
  });

  it('lets a player return to a game they are already in', () => {
    expect(gameCardActions(info({ started: true, withPassword: true }), { alreadyJoined: true }))
      .toMatchObject({ canJoin: true, joinNeedsPassword: false });
  });

  it('marks which actions ask for a password', () => {
    expect(gameCardActions(info({ withPassword: true }))).toMatchObject({ joinNeedsPassword: true, spectateNeedsPassword: false });
    expect(gameCardActions(info({ withPassword: true, spectatorsNeedPassword: true }))).toMatchObject({ spectateNeedsPassword: true });
  });
});
