import { Selectors } from './server.selectors';
import { ServerState } from './server.interfaces';
import {
  makeBanHistoryItem,
  makeDeckList,
  makeReplayMatch,
  makeServerState,
  makeUser,
  makeWarnHistoryItem,
  makeWarnListItem,
} from '../../testing/fixtures/server';
import { create } from '@bufbuild/protobuf';
import {
  Event_NotifyUser_NotificationType,
  Event_NotifyUserSchema,
  Event_ServerShutdownSchema,
  Response_ResponseCode,
  ServerInfo_DeckShareSummarySchema,
  ServerInfo_User_UserLevelFlag,
} from '@cockatrice/sockatrice/generated';
import { ServerCapability } from './server.capabilities';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import { EMPTY_LATENCY, HEALTHY_CONNECTION_HEALTH } from './server.reducer.connection';

function rootState(server: ServerState) {
  return { server };
}

describe('Selectors', () => {
  it('getInitialized → returns initialized flag', () => {
    const state = makeServerState({ initialized: true });
    expect(Selectors.getInitialized(rootState(state))).toBe(true);
  });

  it('getMessage → returns info.message', () => {
    const state = makeServerState({ info: { message: 'Welcome!', name: null, version: null } });
    expect(Selectors.getMessage(rootState(state))).toBe('Welcome!');
  });

  it('getName → returns info.name', () => {
    const state = makeServerState({ info: { message: null, name: 'Servatrice', version: null } });
    expect(Selectors.getName(rootState(state))).toBe('Servatrice');
  });

  it('getSupportsPasswordHash → returns info.supportsPasswordHash, undefined until reported', () => {
    expect(Selectors.getSupportsPasswordHash(rootState(makeServerState()))).toBeUndefined();
    const state = makeServerState({ info: { message: null, name: null, version: null, supportsPasswordHash: true } });
    expect(Selectors.getSupportsPasswordHash(rootState(state))).toBe(true);
  });

  it('getVersion → returns info.version', () => {
    const state = makeServerState({ info: { message: null, name: null, version: '2.9.0' } });
    expect(Selectors.getVersion(rootState(state))).toBe('2.9.0');
  });

  it('getDescription → returns status.description', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: false, state: WebsocketTypes.StatusEnum.CONNECTED, description: 'ok' },
    });
    expect(Selectors.getDescription(rootState(state))).toBe('ok');
  });

  it('getState → returns status.state', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: false, state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
    });
    expect(Selectors.getState(rootState(state))).toBe(WebsocketTypes.StatusEnum.LOGGED_IN);
  });

  it('getConnectionAttemptMade → returns status.connectionAttemptMade', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: true, state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
    });
    expect(Selectors.getConnectionAttemptMade(rootState(state))).toBe(true);
  });

  it('getConnectUnreachable → returns connectUnreachable flag', () => {
    const state = makeServerState({ connectUnreachable: true });
    expect(Selectors.getConnectUnreachable(rootState(state))).toBe(true);
  });

  it('getConnectUnreachable → falls back to false for a partial state missing the field', () => {
    const state = { ...makeServerState(), connectUnreachable: undefined } as unknown as ServerState;
    expect(Selectors.getConnectUnreachable(rootState(state))).toBe(false);
  });

  it('getLoginFailureCode → returns the rejecting response code', () => {
    const state = makeServerState({ loginFailureCode: Response_ResponseCode.RespPasswordChangeRequired });
    expect(Selectors.getLoginFailureCode(rootState(state))).toBe(Response_ResponseCode.RespPasswordChangeRequired);
  });

  it('getLoginFailureCode → falls back to null for a partial state missing the field', () => {
    const state = { ...makeServerState(), loginFailureCode: undefined } as unknown as ServerState;
    expect(Selectors.getLoginFailureCode(rootState(state))).toBeNull();
  });

  it('supports → true for a 3.1 capability on a 3.1 server', () => {
    const state = makeServerState({ info: { message: null, name: 'Rooster', version: '3.1.0-beta.15 (2026-09-27)' } });
    expect(Selectors.supports(rootState(state), ServerCapability.REPORTS)).toBe(true);
  });

  it('supports → false for a 3.1 capability on a 3.0 server', () => {
    const state = makeServerState({ info: { message: null, name: 'Rooster', version: '3.0.0 (2026-05-08)' } });
    expect(Selectors.supports(rootState(state), ServerCapability.REPORTS)).toBe(false);
  });

  it('supports → false before the server has identified itself', () => {
    expect(Selectors.supports(rootState(makeServerState()), ServerCapability.PLAYMATS)).toBe(false);
  });

  it('getIsUserDeveloper → reads the IsDeveloper bit of the local user', () => {
    const developer = makeServerState({ user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsDeveloper }) });
    const plain = makeServerState({ user: makeUser({ userLevel: ServerInfo_User_UserLevelFlag.IsRegistered }) });
    expect(Selectors.getIsUserDeveloper(rootState(developer))).toBe(true);
    expect(Selectors.getIsUserDeveloper(rootState(plain))).toBe(false);
    expect(Selectors.getIsUserDeveloper(rootState(makeServerState({ user: null })))).toBe(false);
  });

  it('getTestConnectionStatus → returns testConnectionStatus', () => {
    const state = makeServerState({ testConnectionStatus: 'success' });
    expect(Selectors.getTestConnectionStatus(rootState(state))).toBe('success');
  });

  it('getConnectionHealth → returns the stored health object', () => {
    const connectionHealth = { missedPongs: 2, silentForMs: 15000 };
    const state = makeServerState({ connectionHealth });
    expect(Selectors.getConnectionHealth(rootState(state))).toBe(connectionHealth);
  });

  it('getConnectionHealth → falls back to the healthy baseline for a partial state missing the field', () => {
    const state = { ...makeServerState(), connectionHealth: undefined } as unknown as ServerState;
    expect(Selectors.getConnectionHealth(rootState(state))).toBe(HEALTHY_CONNECTION_HEALTH);
  });

  it('getLatency → returns the stored latency', () => {
    const latency = { stats: { lastMs: 25, medianMs: 25, p95Ms: 25, maxMs: 25, sampleCount: 1 }, samplesMs: [25] };
    expect(Selectors.getLatency(rootState(makeServerState({ latency })))).toBe(latency);
  });

  it('getLatency → falls back to the empty window for a partial state missing the field', () => {
    const state = { ...makeServerState(), latency: undefined } as unknown as ServerState;
    expect(Selectors.getLatency(rootState(state))).toBe(EMPTY_LATENCY);
  });

  it('getIsServerUnresponsive → true when missedPongs > 0', () => {
    const state = makeServerState({ connectionHealth: { missedPongs: 1, silentForMs: 5000 } });
    expect(Selectors.getIsServerUnresponsive(rootState(state))).toBe(true);
  });

  it('getIsServerUnresponsive → false when missedPongs is 0', () => {
    const state = makeServerState({ connectionHealth: { missedPongs: 0, silentForMs: 0 } });
    expect(Selectors.getIsServerUnresponsive(rootState(state))).toBe(false);
  });

  it('getIsServerUnresponsive → false when connectionHealth is missing', () => {
    const state = { ...makeServerState(), connectionHealth: undefined } as unknown as ServerState;
    expect(Selectors.getIsServerUnresponsive(rootState(state))).toBe(false);
  });

  it('getUser → returns user', () => {
    const user = makeUser({ name: 'Alice' });
    const state = makeServerState({ user });
    expect(Selectors.getUser(rootState(state))).toBe(user);
  });

  it('getUsers → returns users keyed map', () => {
    const users = { TestUser: makeUser(), Bob: makeUser({ name: 'Bob' }) };
    const state = makeServerState({ users });
    expect(Selectors.getUsers(rootState(state))).toBe(users);
  });

  it('getLogs → returns logs object', () => {
    const logs = { room: [], game: [], chat: [] };
    const state = makeServerState({ logs });
    expect(Selectors.getLogs(rootState(state))).toBe(logs);
  });

  it('getBuddyList → returns buddyList keyed map', () => {
    const buddyList = { Carol: makeUser({ name: 'Carol' }) };
    const state = makeServerState({ buddyList });
    expect(Selectors.getBuddyList(rootState(state))).toBe(buddyList);
  });

  it('getIgnoreList → returns ignoreList keyed map', () => {
    const ignoreList = { Dave: makeUser({ name: 'Dave' }) };
    const state = makeServerState({ ignoreList });
    expect(Selectors.getIgnoreList(rootState(state))).toBe(ignoreList);
  });

  it('getReplays → returns replays keyed map', () => {
    const replays = { 1: makeReplayMatch() };
    const state = makeServerState({ replays });
    expect(Selectors.getReplays(rootState(state))).toBe(replays);
  });

  it('getSortedUsers → returns user array sorted by name ASC', () => {
    const users = { Zane: makeUser({ name: 'Zane' }), Alice: makeUser({ name: 'Alice' }) };
    const state = makeServerState({ users });
    const sorted = Selectors.getSortedUsers(rootState(state));
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBe('Zane');
  });

  it('getSortedUsers → returns EMPTY_USERS for empty map', () => {
    const state = makeServerState({ users: {} });
    const sorted = Selectors.getSortedUsers(rootState(state));
    expect(sorted).toHaveLength(0);
  });

  it('getSortedBuddyList → returns buddy array sorted by name ASC', () => {
    const buddyList = { Zane: makeUser({ name: 'Zane' }), Alice: makeUser({ name: 'Alice' }) };
    const state = makeServerState({ buddyList });
    const sorted = Selectors.getSortedBuddyList(rootState(state));
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBe('Zane');
  });

  it('getSortedIgnoreList → returns ignore array sorted by name ASC', () => {
    const ignoreList = { Zane: makeUser({ name: 'Zane' }), Alice: makeUser({ name: 'Alice' }) };
    const state = makeServerState({ ignoreList });
    const sorted = Selectors.getSortedIgnoreList(rootState(state));
    expect(sorted[0].name).toBe('Alice');
    expect(sorted[1].name).toBe('Zane');
  });

  it('getReplaysList → returns replay array sorted by gameId ASC', () => {
    const replays = { 10: makeReplayMatch({ gameId: 10 }), 3: makeReplayMatch({ gameId: 3 }) };
    const state = makeServerState({ replays });
    const sorted = Selectors.getReplaysList(rootState(state));
    expect(sorted[0].gameId).toBe(3);
    expect(sorted[1].gameId).toBe(10);
  });

  it('getBackendDecks → returns backendDecks', () => {
    const backendDecks = makeDeckList();
    const state = makeServerState({ backendDecks });
    expect(Selectors.getBackendDecks(rootState(state))).toBe(backendDecks);
  });

  it('getBackendDecks → returns null when not set', () => {
    const state = makeServerState({ backendDecks: null });
    expect(Selectors.getBackendDecks(rootState(state))).toBeNull();
  });

  it('getDownloadedDeck → returns downloadedDeck', () => {
    const downloadedDeck = { deckId: 42, deck: '<xml>' };
    const state = makeServerState({ downloadedDeck });
    expect(Selectors.getDownloadedDeck(rootState(state))).toEqual(downloadedDeck);
  });

  it('getDeckSharesMine → null until listed, then the share summaries', () => {
    expect(Selectors.getDeckSharesMine(rootState(makeServerState()))).toBeNull();
    const shares = [create(ServerInfo_DeckShareSummarySchema, { id: 3 })];
    expect(Selectors.getDeckSharesMine(rootState(makeServerState({ deckSharesMine: shares })))).toBe(shares);
  });

  it('getPublicDecks → the named user\'s public deck tree', () => {
    const deckList = makeDeckList();
    const state = makeServerState({ publicDecks: { bob: deckList } });
    expect(Selectors.getPublicDecks(rootState(state), 'bob')).toBe(deckList);
    expect(Selectors.getPublicDecks(rootState(state), 'alice')).toBeUndefined();
  });

  it('getDownloadedReplay → returns downloadedReplay', () => {
    const downloadedReplay = { replayId: 99, replayData: new Uint8Array([1, 2, 3]) };
    const state = makeServerState({ downloadedReplay });
    expect(Selectors.getDownloadedReplay(rootState(state))).toEqual(downloadedReplay);
  });

  it('getRegistrationError → returns registrationError', () => {
    const state = makeServerState({ registrationError: 'bad input' });
    expect(Selectors.getRegistrationError(rootState(state))).toBe('bad input');
  });

  it('getNotifications → returns the stored Event_NotifyUser list in arrival order', () => {
    const first = create(Event_NotifyUserSchema, { type: Event_NotifyUser_NotificationType.PROMOTED });
    const second = create(Event_NotifyUserSchema, { type: Event_NotifyUser_NotificationType.WARNING, warningReason: 'spam' });
    const state = makeServerState({ notifications: [first, second] });
    expect(Selectors.getNotifications(rootState(state))).toEqual([first, second]);
  });

  it('getServerShutdown → returns the pending shutdown, or null', () => {
    const shutdown = create(Event_ServerShutdownSchema, { reason: 'maintenance', minutes: 10 });
    expect(Selectors.getServerShutdown(rootState(makeServerState({ serverShutdown: shutdown })))).toBe(shutdown);
    expect(Selectors.getServerShutdown(rootState(makeServerState()))).toBeNull();
  });


  it('getIsConnected → true when state is LOGGED_IN', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: true, state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
    });
    expect(Selectors.getIsConnected(rootState(state))).toBe(true);
  });

  it('getIsConnected → false when state is CONNECTED', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: true, state: WebsocketTypes.StatusEnum.CONNECTED, description: null },
    });
    expect(Selectors.getIsConnected(rootState(state))).toBe(false);
  });

  it('getIsConnected → false when state is DISCONNECTED', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: false, state: WebsocketTypes.StatusEnum.DISCONNECTED, description: null },
    });
    expect(Selectors.getIsConnected(rootState(state))).toBe(false);
  });

  it('getIsUserModerator → true when user has IsModerator flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsModerator });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserModerator(rootState(state))).toBe(true);
  });

  it('getIsUserModerator → false when user lacks IsModerator flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsRegistered });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserModerator(rootState(state))).toBe(false);
  });

  it('getIsUserModerator → false when user is null', () => {
    const state = makeServerState({ user: null });
    expect(Selectors.getIsUserModerator(rootState(state))).toBe(false);
  });

  it('getIsUserJudge → true when user has IsJudge flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsJudge });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserJudge(rootState(state))).toBe(true);
  });

  it('getIsUserJudge → false when user lacks IsJudge flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserJudge(rootState(state))).toBe(false);
  });

  it('getIsUserJudge → false when user is null', () => {
    const state = makeServerState({ user: null });
    expect(Selectors.getIsUserJudge(rootState(state))).toBe(false);
  });

  it('getIsUserRegistered → true when user has IsRegistered flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsRegistered });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserRegistered(rootState(state))).toBe(true);
  });

  it('getIsUserRegistered → false when user lacks IsRegistered flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserRegistered(rootState(state))).toBe(false);
  });

  it('getIsUserRegistered → false when user is null', () => {
    const state = makeServerState({ user: null });
    expect(Selectors.getIsUserRegistered(rootState(state))).toBe(false);
  });

  it('getIsUserAdmin → true when user has IsAdmin flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsAdmin });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserAdmin(rootState(state))).toBe(true);
  });

  it('getIsUserAdmin → false when user lacks IsAdmin flag', () => {
    const Flag = ServerInfo_User_UserLevelFlag;
    const user = makeUser({ userLevel: Flag.IsUser | Flag.IsModerator });
    const state = makeServerState({ user });
    expect(Selectors.getIsUserAdmin(rootState(state))).toBe(false);
  });

  it('getIsUserAdmin → false when user is null', () => {
    const state = makeServerState({ user: null });
    expect(Selectors.getIsUserAdmin(rootState(state))).toBe(false);
  });

  it('getPrivateMessagesForUser → returns the stored conversation for that user', () => {
    // The reducer keys both sent + received under the OTHER user's
    // name, so a single lookup returns the full conversation.
    const msg = {
      $typeName: 'Event_UserMessage' as const, senderName: 'Bob', receiverName: 'Alice', message: 'gg', timeReceived: 123,
    } as never;
    const state = makeServerState({ messages: { Bob: [msg] } });
    expect(Selectors.getPrivateMessagesForUser(rootState(state), 'Bob')).toEqual([msg]);
  });

  it('getPrivateMessagesForUser → returns the same empty-array sentinel for unknown peers', () => {
    // Stable empty-array reference so memoized selectors don't churn
    // on every render when there's no conversation yet.
    const state = makeServerState({ messages: {} });
    const a = Selectors.getPrivateMessagesForUser(rootState(state), 'Bob');
    const b = Selectors.getPrivateMessagesForUser(rootState(state), 'Carol');
    expect(a).toEqual([]);
    expect(a).toBe(b);
  });

  it('getPrivateConversation → slots notices between messages by position', () => {
    const m = (message: string) =>
      ({ $typeName: 'Event_UserMessage' as const, senderName: 'Bob', receiverName: 'Alice', message, timeReceived: 123 }) as never;
    const [a, b] = [m('a'), m('b')];
    const state = makeServerState({
      messages: { Bob: [a, b] },
      privateChatNotices: {
        Bob: [
          { id: 1, kind: 'userJoined', position: 0 },
          { id: 2, kind: 'chatFlood', position: 1 },
          { id: 3, kind: 'userLeft', position: 2 },
        ],
      },
    });
    const entries = Selectors.getPrivateConversation(rootState(state), 'Bob');
    expect(entries.map((e) => (e.type === 'message' ? e.message : e.notice.kind))).toEqual(
      ['userJoined', a, 'chatFlood', b, 'userLeft'],
    );
    expect(Selectors.getPrivateConversation(rootState(state), 'Bob')).toBe(entries);
  });

  it('getPrivateConversation → lists notices of a conversation without messages', () => {
    const state = makeServerState({ privateChatNotices: { Bob: [{ id: 1, kind: 'recipientOffline', position: 0 }] } });
    expect(Selectors.getPrivateConversation(rootState(state), 'Bob')).toEqual([
      { type: 'notice', notice: { id: 1, kind: 'recipientOffline', position: 0 } },
    ]);
  });

  it('getGamesOfUser → lists the stored games and a stable empty array otherwise', () => {
    const game = { info: { gameId: 7 }, gameType: 'Standard' } as never;
    const state = makeServerState({ gamesOfUser: { bob: { 7: game } } });
    expect(Selectors.getGamesOfUser(rootState(state), 'bob')).toEqual([game]);
    expect(Selectors.getGamesOfUser(rootState(state), 'bob')).toBe(Selectors.getGamesOfUser(rootState(state), 'bob'));
    expect(Selectors.getGamesOfUser(rootState(state), 'carol')).toEqual([]);
  });

  it('getGamesOfUserStatus → returns the request lifecycle for a user', () => {
    const state = makeServerState({ gamesOfUserStatus: { bob: { state: 'failed', responseCode: 6 } } });
    expect(Selectors.getGamesOfUserStatus(rootState(state), 'bob')).toEqual({ state: 'failed', responseCode: 6 });
    expect(Selectors.getGamesOfUserStatus(rootState(state), 'carol')).toBeUndefined();
  });

  it('getIsUserOnline → reflects the online user list', () => {
    const state = makeServerState({ users: { Bob: makeUser({ name: 'Bob' }) } });
    expect(Selectors.getIsUserOnline(rootState(state), 'Bob')).toBe(true);
    expect(Selectors.getIsUserOnline(rootState(state), 'Carol')).toBe(false);
  });

  it('getSortedBuddyList → returns EMPTY_USERS for empty map', () => {
    const state = makeServerState({ buddyList: {} });
    expect(Selectors.getSortedBuddyList(rootState(state))).toHaveLength(0);
  });

  it('getSortedIgnoreList → returns EMPTY_USERS for empty map', () => {
    const state = makeServerState({ ignoreList: {} });
    expect(Selectors.getSortedIgnoreList(rootState(state))).toHaveLength(0);
  });

  it('getReplaysList → returns EMPTY_REPLAYS for empty map', () => {
    const state = makeServerState({ replays: {} });
    expect(Selectors.getReplaysList(rootState(state))).toHaveLength(0);
  });

  it('getUserInfoByName → returns the user info entry by name', () => {
    const alice = makeUser({ name: 'Alice' });
    const state = makeServerState({ userInfo: { Alice: alice } });
    expect(Selectors.getUserInfoByName(rootState(state), 'Alice')).toBe(alice);
  });

  it('getUserInfoByName → returns undefined for unknown name', () => {
    const state = makeServerState({ userInfo: {} });
    expect(Selectors.getUserInfoByName(rootState(state), 'Nobody')).toBeUndefined();
  });

  it('getBanHistoryByUser → returns the stored ban history for that user', () => {
    const bans = [makeBanHistoryItem({ adminName: 'Mod' })];
    const state = makeServerState({ banHistory: { Alice: bans } });
    expect(Selectors.getBanHistoryByUser(rootState(state), 'Alice')).toBe(bans);
  });

  it('getBanHistoryByUser → returns undefined for a user with no history', () => {
    const state = makeServerState({ banHistory: {} });
    expect(Selectors.getBanHistoryByUser(rootState(state), 'Nobody')).toBeUndefined();
  });

  it('getWarnHistoryByUser → returns the stored warn history for that user', () => {
    const warnings = [makeWarnHistoryItem({ reason: 'spam' })];
    const state = makeServerState({ warnHistory: { Alice: warnings } });
    expect(Selectors.getWarnHistoryByUser(rootState(state), 'Alice')).toBe(warnings);
  });

  it('getAdminNotesByUser → returns the stored admin note for that user', () => {
    const state = makeServerState({ adminNotes: { Alice: 'watch this account' } });
    expect(Selectors.getAdminNotesByUser(rootState(state), 'Alice')).toBe('watch this account');
  });

  it('getWarnListForUser → returns the warn list the server echoed for that user', () => {
    const forAlice = makeWarnListItem({ warning: ['Spamming'], userName: 'Alice', userClientid: 'cid' });
    const state = makeServerState({ warnListOptions: [forAlice] });
    expect(Selectors.getWarnListForUser(rootState(state), 'Alice')).toBe(forAlice);
    expect(Selectors.getWarnListForUser(rootState(state), 'Bob')).toBeUndefined();
  });

  it('getSortUsersBy → returns sortUsersBy', () => {
    const state = makeServerState();
    expect(Selectors.getSortUsersBy(rootState(state))).toBe(state.sortUsersBy);
  });


  it('getIsConnected → returns same value reference for identical state', () => {
    const state = makeServerState({
      status: { connectionAttemptMade: true, state: WebsocketTypes.StatusEnum.LOGGED_IN, description: null },
    });
    const root = rootState(state);
    const a = Selectors.getIsConnected(root);
    const b = Selectors.getIsConnected(root);
    expect(a).toBe(b);
  });

  it('getSortedUsers → returns same array reference for identical state', () => {
    const users = { Alice: makeUser({ name: 'Alice' }), Bob: makeUser({ name: 'Bob' }) };
    const state = makeServerState({ users });
    const root = rootState(state);
    const a = Selectors.getSortedUsers(root);
    const b = Selectors.getSortedUsers(root);
    expect(a).toBe(b);
  });

  it('getSortedBuddyList → returns same array reference for identical state', () => {
    const buddyList = { Alice: makeUser({ name: 'Alice' }) };
    const state = makeServerState({ buddyList });
    const root = rootState(state);
    const a = Selectors.getSortedBuddyList(root);
    const b = Selectors.getSortedBuddyList(root);
    expect(a).toBe(b);
  });

  it('getSortedIgnoreList → returns same array reference for identical state', () => {
    const ignoreList = { Troll: makeUser({ name: 'Troll' }) };
    const state = makeServerState({ ignoreList });
    const root = rootState(state);
    const a = Selectors.getSortedIgnoreList(root);
    const b = Selectors.getSortedIgnoreList(root);
    expect(a).toBe(b);
  });

  it('getReplaysList → returns same array reference for identical state', () => {
    const replays = { 1: makeReplayMatch({ gameId: 1 }) };
    const state = makeServerState({ replays });
    const root = rootState(state);
    const a = Selectors.getReplaysList(root);
    const b = Selectors.getReplaysList(root);
    expect(a).toBe(b);
  });
});

it('returns an empty conversation when neither messages nor notices exist', () => {
  const state = rootState(makeServerState());
  expect(Selectors.getPrivateConversation(state, 'unknown')).toEqual([]);
  expect(state.server.messages.unknown).toBeUndefined();
  expect(state.server.privateChatNotices.unknown).toBeUndefined();
});
