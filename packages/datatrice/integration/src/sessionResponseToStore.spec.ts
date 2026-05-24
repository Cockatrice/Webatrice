import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { attachResponseHandlers, createStore, server } from '../../src';
import {
  Event_GameJoinedSchema,
  Event_NotifyUser,
  Event_PlayerPropertiesChangedSchema,
  Event_ServerShutdown,
  Event_UserMessageSchema,
  Response_DeckDownloadSchema,
  Response_DeckListSchema,
  Response_GetGamesOfUserSchema,
  Response_ReplayDownloadSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  ServerInfo_GameSchema,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_ReplayMatch,
  ServerInfo_ReplayMatchSchema,
  ServerInfo_User,
  ServerInfo_UserSchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';

// Integration: drives every SessionResponseImpl handler method through the
// real store — connection/auth lifecycle, server info, the user list,
// buddy/ignore lists, account editing, server-side decks, replays, messaging,
// notifications and getGamesOfUser. Assertions go through server.selectors so
// the SortUtil-backed selector layer is exercised too.

function makeUser(name: string, userLevel = 0): ServerInfo_User {
  return create(ServerInfo_UserSchema, { name, userLevel, accountageSecs: 0n });
}

// --- connection + auth lifecycle ----------------------------------------

describe('integration: session connection lifecycle', () => {
  it('initialized resets the slice with initialized=true', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.initialized();
    expect(server.Selectors.getInitialized(store.getState())).toBe(true);
  });

  it('connectionAttempted then testConnection drives the test-connection status', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.connectionAttempted();
    expect(server.Selectors.getConnectionAttemptMade(store.getState())).toBe(true);

    response.session.testConnectionSuccessful(true);
    expect(server.Selectors.getTestConnectionStatus(store.getState())).toBe('success');

    response.session.testConnectionFailed();
    expect(server.Selectors.getTestConnectionStatus(store.getState())).toBe('failed');
  });

  it('updateInfo + serverMessage populate server info selectors', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateInfo('Cockatrice Server', '2.11');
    response.session.serverMessage('Welcome!');

    const state = store.getState();
    expect(server.Selectors.getName(state)).toBe('Cockatrice Server');
    expect(server.Selectors.getVersion(state)).toBe('2.11');
    expect(server.Selectors.getMessage(state)).toBe('Welcome!');
  });

  it('updateStatus to LOGGED_IN flips getIsConnected, DISCONNECTED resets it', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');
    expect(server.Selectors.getIsConnected(store.getState())).toBe(true);
    expect(server.Selectors.getState(store.getState())).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);

    // updateStatus(DISCONNECTED) triggers the server listener -> disconnected().
    response.session.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'gone');
    expect(server.Selectors.getIsConnected(store.getState())).toBe(false);
  });

  it('signal-only auth events flow through the bridge without error', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    expect(() => {
      response.session.loginSuccessful({ userName: 'alice' } as WebsocketTypes.LoginSuccessContext);
      response.session.loginFailed();
      response.session.connectionFailed();
      response.session.accountAwaitingActivation({ userName: 'alice' } as WebsocketTypes.PendingActivationContext);
      response.session.accountActivationSuccess();
      response.session.accountActivationFailed();
      response.session.registrationRequiresEmail();
      response.session.registrationSuccess();
      response.session.registrationEmailError('bad email');
      response.session.registrationPasswordError('weak password');
      response.session.registrationUserNameError('taken');
      response.session.resetPasswordChallenge();
      response.session.resetPassword();
      response.session.resetPasswordSuccess();
      response.session.resetPasswordFailed();
      response.session.accountPasswordChange();
      response.session.addToList('buddy', 'bob');
      response.session.removeFromList('buddy', 'bob');
    }).not.toThrow();
  });

  it('registrationFailed sets a registration error', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.registrationFailed('server disabled');
    expect(server.Selectors.getRegistrationError(store.getState())).toBe('server disabled');
  });

  it('registrationFailed with endTime produces a banned-user error string', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.registrationFailed('abuse', Date.now() + 100_000);
    expect(server.Selectors.getRegistrationError(store.getState())).toContain('You are banned until');
  });

  it('serverShutdown stores the shutdown payload', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const data = { reason: 'maintenance', minutes: 5 } as unknown as Event_ServerShutdown;
    response.session.serverShutdown(data);
    expect(store.getState().server.serverShutdown).toEqual(data);
  });

  it('clearStore preserves status but resets the rest', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');
    response.session.updateUsers([makeUser('alice')]);

    response.session.clearStore();
    const state = store.getState();
    expect(server.Selectors.getState(state)).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
    expect(Object.keys(server.Selectors.getUsers(state))).toHaveLength(0);
  });
});

// --- users + buddy/ignore lists -----------------------------------------

describe('integration: session user lists', () => {
  it('updateUsers + userJoined + userLeft maintain the sorted user list', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateUsers([makeUser('charlie'), makeUser('alice')]);
    response.session.userJoined(makeUser('bob'));

    let sorted = server.Selectors.getSortedUsers(store.getState());
    expect(sorted.map(u => u.name)).toEqual(['alice', 'bob', 'charlie']);

    response.session.userLeft('bob');
    sorted = server.Selectors.getSortedUsers(store.getState());
    expect(sorted.map(u => u.name)).toEqual(['alice', 'charlie']);
  });

  it('sorted user list ranks moderators above regular users', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const mod = makeUser('zelda', ServerInfo_User_UserLevelFlag.IsModerator);
    response.session.updateUsers([makeUser('alice'), mod]);

    const sorted = server.Selectors.getSortedUsers(store.getState());
    // userComparator sorts by userLevel DESC first, so the moderator leads.
    expect(sorted[0].name).toBe('zelda');
  });

  it('updateUser merges into the current user', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(makeUser('alice', 4));
    expect(server.Selectors.getUser(store.getState())?.name).toBe('alice');
  });

  it('buddy list: update / add / remove reflected through getSortedBuddyList', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateBuddyList([makeUser('dave'), makeUser('amy')]);
    expect(server.Selectors.getSortedBuddyList(store.getState()).map(u => u.name)).toEqual(['amy', 'dave']);

    response.session.addToBuddyList(makeUser('bea'));
    expect(server.Selectors.getSortedBuddyList(store.getState()).map(u => u.name)).toEqual(['amy', 'bea', 'dave']);

    response.session.removeFromBuddyList('dave');
    expect(server.Selectors.getSortedBuddyList(store.getState()).map(u => u.name)).toEqual(['amy', 'bea']);
  });

  it('ignore list: update / add / remove reflected through getSortedIgnoreList', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.updateIgnoreList([makeUser('troll')]);
    response.session.addToIgnoreList(makeUser('spammer'));
    expect(server.Selectors.getSortedIgnoreList(store.getState()).map(u => u.name)).toEqual(['spammer', 'troll']);

    response.session.removeFromIgnoreList('troll');
    expect(server.Selectors.getSortedIgnoreList(store.getState()).map(u => u.name)).toEqual(['spammer']);
  });

  it('getUserInfo stores per-name user info', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.getUserInfo(makeUser('eve', 1));
    expect(server.Selectors.getUserInfoByName(store.getState(), 'eve')?.userLevel).toBe(1);
  });
});

// --- account editing -----------------------------------------------------

describe('integration: session account editing', () => {
  it('accountEditChanged merges fields into the current user', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(makeUser('alice'));
    response.session.accountEditChanged('Alice Smith', 'alice@example.com', 'US');

    const user = server.Selectors.getUser(store.getState());
    expect(user?.realName).toBe('Alice Smith');
    expect(user?.email).toBe('alice@example.com');
    expect(user?.country).toBe('US');
  });

  it('accountImageChanged updates the avatar bitmap', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(makeUser('alice'));
    const bmp = new Uint8Array([1, 2, 3]);
    response.session.accountImageChanged(bmp);
    expect(server.Selectors.getUser(store.getState())?.avatarBmp).toEqual(bmp);
  });
});

// --- messaging + notifications ------------------------------------------

describe('integration: session messaging and notifications', () => {
  it('userMessage stores private messages keyed by the other party', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateUser(makeUser('alice'));

    response.session.userMessage(create(Event_UserMessageSchema, {
      senderName: 'alice', receiverName: 'bob', message: 'hi bob',
    }));
    expect(store.getState().server.messages['bob']).toHaveLength(1);
  });

  it('notifyUser appends a notification', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.notifyUser({ type: 1 } as unknown as Event_NotifyUser);
    expect(store.getState().server.notifications).toHaveLength(1);
  });

  it('playerPropertiesChanged dispatches a game action only when properties are present', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    // Seed a game with a player so the game listener has something to merge.
    response.session.gameJoined(create(Event_GameJoinedSchema, {
      gameInfo: create(ServerInfo_GameSchema, { gameId: 99, roomId: 1, description: 'g' }),
      hostId: 1, playerId: 1, spectator: false, judge: false, resuming: false,
    }));
    response.game.playerJoined(99, create(ServerInfo_PlayerPropertiesSchema, {
      playerId: 1, userInfo: { name: 'Alice' },
    }));

    response.session.playerPropertiesChanged(99, 1, create(Event_PlayerPropertiesChangedSchema, {
      playerProperties: create(ServerInfo_PlayerPropertiesSchema, { playerId: 1, readyStart: true }),
    }));
    expect(store.getState().games.games[99].players[1].properties.readyStart).toBe(true);

    // With no playerProperties on the payload the handler short-circuits.
    expect(() => response.session.playerPropertiesChanged(99, 1,
      create(Event_PlayerPropertiesChangedSchema, {}))).not.toThrow();
  });

  it('getGamesOfUser stores normalized games keyed by username', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    const gamesResponse = create(Response_GetGamesOfUserSchema, {
      gameList: [create(ServerInfo_GameSchema, { gameId: 7, description: 'old game' })],
      roomList: [],
    });
    response.session.getGamesOfUser('alice', gamesResponse);
    expect(store.getState().server.gamesOfUser['alice'][7]).toBeDefined();
  });
});

// --- server-side decks ---------------------------------------------------

describe('integration: session server decks', () => {
  function withDeckRoot() {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.updateServerDecks(create(Response_DeckListSchema, {
      root: create(ServerInfo_DeckStorage_FolderSchema, { items: [] }),
    }));
    return { store, response };
  }

  it('updateServerDecks sets the backend deck tree', () => {
    const { store } = withDeckRoot();
    expect(server.Selectors.getBackendDecks(store.getState())?.root).toBeDefined();
  });

  it('uploadServerDeck inserts a tree item at the root', () => {
    const { store, response } = withDeckRoot();
    response.session.uploadServerDeck('', create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: 11, name: 'My Deck',
    }));
    const items = server.Selectors.getBackendDecks(store.getState())?.root?.items ?? [];
    expect(items.map(i => i.name)).toContain('My Deck');
  });

  it('createServerDeckDir adds a folder, deleteServerDeckDir removes it', () => {
    const { store, response } = withDeckRoot();
    response.session.createServerDeckDir('', 'Standard');
    let items = server.Selectors.getBackendDecks(store.getState())?.root?.items ?? [];
    expect(items.map(i => i.name)).toContain('Standard');

    response.session.deleteServerDeckDir('Standard');
    items = server.Selectors.getBackendDecks(store.getState())?.root?.items ?? [];
    expect(items.map(i => i.name)).not.toContain('Standard');
  });

  it('deleteServerDeck removes a deck by id', () => {
    const { store, response } = withDeckRoot();
    response.session.uploadServerDeck('', create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: 22, name: 'Doomed Deck',
    }));
    response.session.deleteServerDeck(22);
    const items = server.Selectors.getBackendDecks(store.getState())?.root?.items ?? [];
    expect(items).toHaveLength(0);
  });

  it('downloadServerDeck stores the downloaded deck payload', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.downloadServerDeck(5, create(Response_DeckDownloadSchema, { deck: '<deck/>' }));
    expect(server.Selectors.getDownloadedDeck(store.getState())).toEqual({ deckId: 5, deck: '<deck/>' });
  });
});

// --- replays -------------------------------------------------------------

describe('integration: session replays', () => {
  function makeReplay(gameId: number): ServerInfo_ReplayMatch {
    return create(ServerInfo_ReplayMatchSchema, {
      gameId, roomName: 'Room', gameName: `Game ${gameId}`, playerNames: [], replayList: [],
    });
  }

  it('replayList + replayAdded reflected through getReplaysList sorted by gameId', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);

    response.session.replayList([makeReplay(3), makeReplay(1)]);
    response.session.replayAdded(makeReplay(2));

    expect(server.Selectors.getReplaysList(store.getState()).map(r => r.gameId)).toEqual([1, 2, 3]);
  });

  it('replayModifyMatch flips doNotHide on an existing match', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.replayList([makeReplay(1)]);
    response.session.replayModifyMatch(1, true);
    expect(store.getState().server.replays[1].doNotHide).toBe(true);
  });

  it('replayDeleteMatch removes a match', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    response.session.replayList([makeReplay(1), makeReplay(2)]);
    response.session.replayDeleteMatch(1);
    expect(server.Selectors.getReplaysList(store.getState()).map(r => r.gameId)).toEqual([2]);
  });

  it('replayDownloaded stores the downloaded replay payload', () => {
    const store = createStore();
    const response = attachResponseHandlers(store);
    const bytes = new Uint8Array([9, 8, 7]);
    response.session.replayDownloaded(4, create(Response_ReplayDownloadSchema, { replayData: bytes }));
    expect(server.Selectors.getDownloadedReplay(store.getState())).toEqual({ replayId: 4, replayData: bytes });
  });
});
