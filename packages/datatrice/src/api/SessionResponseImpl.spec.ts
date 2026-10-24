import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { createStore } from '../store/createStore';
import {
  Event_GameJoinedSchema,
  Event_NotifyUserSchema,
  Event_NotifyUser_NotificationType,
  Event_PlayerPropertiesChangedSchema,
  Event_ServerShutdownSchema,
  Event_UserMessageSchema,
  Response_DeckDownloadSchema,
  Response_DeckListSchema,
  Response_DeckShareCreateSchema,
  Response_DeckShareListSchema,
  Response_GetGamesOfUserSchema,
  Response_ReplayDownloadSchema,
  Response_ResponseCode,
  ServerInfo_DeckShareSummarySchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  ServerInfo_PlayerPropertiesSchema,
  ServerInfo_ReplayMatchSchema,
  ServerInfo_ReportSchema,
  ServerInfo_UserSchema,
} from '@cockatrice/sockatrice/generated';
import { Actions as ServerActions } from '../store/server/server.actions';
import { Actions as GameActions } from '../store/games/game.actions';
import { SessionResponseImpl } from './SessionResponseImpl';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { store, impl: new SessionResponseImpl(store), dispatch };
}

describe('SessionResponseImpl.loginFailed', () => {
  it('keeps the rejection code through the disconnect that follows a rejected login', () => {
    const { store, impl } = setup();
    impl.connectionAttempted();
    impl.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'Login failed: server is full');
    impl.loginFailed(Response_ResponseCode.RespServerFull);
    impl.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'Login failed: server is full');
    expect(store.getState().server.loginFailureCode).toBe(Response_ResponseCode.RespServerFull);
  });

  it('clears the rejection code on the next connection attempt', () => {
    const { store, impl } = setup();
    impl.loginFailed(Response_ResponseCode.RespPasswordChangeRequired);
    impl.connectionAttempted();
    expect(store.getState().server.loginFailureCode).toBeNull();
  });

  it('records no code when the login never reached Command_Login', () => {
    const { store, impl } = setup();
    impl.loginFailed();
    expect(store.getState().server.loginFailureCode).toBeNull();
  });
});

describe('SessionResponseImpl.updateStatus', () => {
  // updateStatus is the one method whose effect propagates through the server
  // listener (DISCONNECTED triggers a follow-up `disconnected()` action that
  // resets the slice). Keep the real-store assertions for the listener path;
  // the other 55 methods are pure forwarders and tested via dispatch spy below.
  it('writes status into server.status when transitioning to DISCONNECTED', () => {
    const { store, impl } = setup();
    impl.updateStatus(WebsocketTypes.StatusEnum.DISCONNECTED, 'gone');
    expect(store.getState().server.status).toMatchObject({
      state: WebsocketTypes.StatusEnum.DISCONNECTED,
      description: 'gone',
    });
  });

  it('writes status into server.status on non-DISCONNECTED transitions', () => {
    const { store, impl } = setup();
    impl.updateStatus(WebsocketTypes.StatusEnum.CONNECTED, 'connected');
    expect(store.getState().server.status).toMatchObject({
      state: WebsocketTypes.StatusEnum.CONNECTED,
      description: 'connected',
    });
  });

  it('writes status into server.status on LOGGED_IN transition', () => {
    const { store, impl } = setup();
    impl.updateStatus(WebsocketTypes.StatusEnum.LOGGED_IN, 'in');
    expect(store.getState().server.status).toMatchObject({
      state: WebsocketTypes.StatusEnum.LOGGED_IN,
      description: 'in',
    });
  });
});

describe('SessionResponseImpl forwards', () => {
  it('initialized', () => {
    const { impl, dispatch } = setup();
    impl.initialized();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.initialized());
  });

  it('connectionAttempted', () => {
    const { impl, dispatch } = setup();
    impl.connectionAttempted();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.connectionAttempted());
  });

  it('clearStore', () => {
    const { impl, dispatch } = setup();
    impl.clearStore();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.clearStore());
  });

  it('loginSuccessful', () => {
    const { impl, dispatch } = setup();
    const options = { userName: 'alice' } as WebsocketTypes.LoginSuccessContext;
    impl.loginSuccessful(options);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.loginSuccessful({ options }));
  });

  it('loginFailed', () => {
    const { impl, dispatch } = setup();
    impl.loginFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.loginFailed());
  });

  it('loginFailed forwards the rejecting response code', () => {
    const { impl, dispatch } = setup();
    impl.loginFailed(Response_ResponseCode.RespServerFull);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.loginFailed({ responseCode: Response_ResponseCode.RespServerFull }));
  });

  it('connectionFailed', () => {
    const { impl, dispatch } = setup();
    impl.connectionFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.connectionFailed());
  });

  it('connectionUnreachable', () => {
    const { impl, dispatch } = setup();
    impl.connectionUnreachable();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.connectUnreachable());
  });

  it('testConnectionSuccessful', () => {
    const { impl, dispatch } = setup();
    impl.testConnectionSuccessful(true);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.testConnectionSuccessful({ supportsHashedPassword: true }));
  });

  it('testConnectionFailed', () => {
    const { impl, dispatch } = setup();
    impl.testConnectionFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.testConnectionFailed());
  });

  it('updateBuddyList', () => {
    const { impl, dispatch } = setup();
    const buddyList = [create(ServerInfo_UserSchema, { name: 'alice' })];
    impl.updateBuddyList(buddyList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateBuddyList({ buddyList }));
  });

  it('addToBuddyList', () => {
    const { impl, dispatch } = setup();
    const user = create(ServerInfo_UserSchema, { name: 'alice' });
    impl.addToBuddyList(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.addToBuddyList({ user }));
  });

  it('removeFromBuddyList', () => {
    const { impl, dispatch } = setup();
    impl.removeFromBuddyList('alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.removeFromBuddyList({ userName: 'alice' }));
  });

  it('updateIgnoreList', () => {
    const { impl, dispatch } = setup();
    const ignoreList = [create(ServerInfo_UserSchema, { name: 'bob' })];
    impl.updateIgnoreList(ignoreList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateIgnoreList({ ignoreList }));
  });

  it('addToIgnoreList', () => {
    const { impl, dispatch } = setup();
    const user = create(ServerInfo_UserSchema, { name: 'bob' });
    impl.addToIgnoreList(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.addToIgnoreList({ user }));
  });

  it('removeFromIgnoreList', () => {
    const { impl, dispatch } = setup();
    impl.removeFromIgnoreList('bob');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.removeFromIgnoreList({ userName: 'bob' }));
  });

  it('updateInfo packs name + version + password-hash capability into an info object', () => {
    const { impl, dispatch } = setup();
    impl.updateInfo('Servatrice', '2.7.0', true);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateInfo({
      info: { name: 'Servatrice', version: '2.7.0', supportsPasswordHash: true },
    }));
  });

  it('updateInfo without the capability reports it as unknown', () => {
    const { impl, dispatch } = setup();
    impl.updateInfo('Servatrice', '2.7.0');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateInfo({
      info: { name: 'Servatrice', version: '2.7.0', supportsPasswordHash: undefined },
    }));
  });

  it('updateUser', () => {
    const { impl, dispatch } = setup();
    const user = create(ServerInfo_UserSchema, { name: 'alice' });
    impl.updateUser(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateUser({ user }));
  });

  it('updateConnectionHealth', () => {
    const { impl, dispatch } = setup();
    impl.updateConnectionHealth(2, 10000);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.connectionHealthChanged({ missedPongs: 2, silentForMs: 10000 }));
  });

  it('updateLatencyStats', () => {
    const { impl, dispatch } = setup();
    const stats = { lastMs: 30, medianMs: 30, p95Ms: 30, maxMs: 30, sampleCount: 1 };
    impl.updateLatencyStats(stats, [30]);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.latencyStatsUpdated({ stats, samplesMs: [30] }));
  });

  it('updateUsers', () => {
    const { impl, dispatch } = setup();
    const users = [create(ServerInfo_UserSchema, { name: 'alice' })];
    impl.updateUsers(users);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateUsers({ users }));
  });

  it('userJoined', () => {
    const { impl, dispatch } = setup();
    const user = create(ServerInfo_UserSchema, { name: 'alice' });
    impl.userJoined(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.userJoined({ user }));
  });

  it('userLeft maps userName → name in the payload', () => {
    const { impl, dispatch } = setup();
    impl.userLeft('alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.userLeft({ name: 'alice' }));
  });

  it('serverMessage', () => {
    const { impl, dispatch } = setup();
    impl.serverMessage('be right back');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.serverMessage({ message: 'be right back' }));
  });

  it('accountAwaitingActivation', () => {
    const { impl, dispatch } = setup();
    const options = { userName: 'alice' } as WebsocketTypes.PendingActivationContext;
    impl.accountAwaitingActivation(options);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountAwaitingActivation({ options }));
  });

  it('accountActivationSuccess', () => {
    const { impl, dispatch } = setup();
    impl.accountActivationSuccess();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountActivationSuccess());
  });

  it('accountActivationFailed', () => {
    const { impl, dispatch } = setup();
    impl.accountActivationFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountActivationFailed());
  });

  it('accountActivationFailed carries a transport failure reason', () => {
    const { impl, dispatch } = setup();
    impl.accountActivationFailed(WebsocketTypes.CommandFailure.Timeout);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountActivationFailed({ failure: WebsocketTypes.CommandFailure.Timeout }));
  });

  it('registrationRequiresEmail', () => {
    const { impl, dispatch } = setup();
    impl.registrationRequiresEmail();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationRequiresEmail());
  });

  it('registrationSuccess', () => {
    const { impl, dispatch } = setup();
    impl.registrationSuccess();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationSuccess());
  });

  it('registrationFailed with reason only', () => {
    const { impl, dispatch } = setup();
    impl.registrationFailed('banned');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationFailed({ reason: 'banned', endTime: undefined }));
  });

  it('registrationFailed with reason and endTime', () => {
    const { impl, dispatch } = setup();
    impl.registrationFailed('banned', 9999);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationFailed({ reason: 'banned', endTime: 9999 }));
  });

  it('registrationEmailError', () => {
    const { impl, dispatch } = setup();
    impl.registrationEmailError('bad email');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationEmailError({ error: 'bad email' }));
  });

  it('registrationPasswordError', () => {
    const { impl, dispatch } = setup();
    impl.registrationPasswordError('weak');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationPasswordError({ error: 'weak' }));
  });

  it('registrationUserNameError', () => {
    const { impl, dispatch } = setup();
    impl.registrationUserNameError('taken');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.registrationUserNameError({ error: 'taken' }));
  });

  it('resetPasswordChallenge', () => {
    const { impl, dispatch } = setup();
    impl.resetPasswordChallenge();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.resetPasswordChallenge());
  });

  it('resetPassword', () => {
    const { impl, dispatch } = setup();
    impl.resetPassword();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.resetPassword());
  });

  it('resetPasswordSuccess', () => {
    const { impl, dispatch } = setup();
    impl.resetPasswordSuccess();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.resetPasswordSuccess());
  });

  it('resetPasswordFailed', () => {
    const { impl, dispatch } = setup();
    impl.resetPasswordFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.resetPasswordFailed());
  });

  it('accountPasswordChange', () => {
    const { impl, dispatch } = setup();
    impl.accountPasswordChange();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountPasswordChange());
  });

  it('accountEditChanged packs three optionals into a user object', () => {
    const { impl, dispatch } = setup();
    impl.accountEditChanged('Alice', 'alice@example.com', 'US');
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.accountEditChanged({ user: { realName: 'Alice', email: 'alice@example.com', country: 'US' } }),
    );
  });

  it('accountEditChanged accepts undefined for any field', () => {
    const { impl, dispatch } = setup();
    impl.accountEditChanged(undefined, 'alice@example.com');
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.accountEditChanged({ user: { realName: undefined, email: 'alice@example.com', country: undefined } }),
    );
  });

  it('accountImageChanged packs avatarBmp into a user object', () => {
    const { impl, dispatch } = setup();
    const avatarBmp = new Uint8Array([1, 2, 3]);
    impl.accountImageChanged(avatarBmp);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.accountImageChanged({ user: { avatarBmp } }));
  });

  it('getUserInfo', () => {
    const { impl, dispatch } = setup();
    const userInfo = create(ServerInfo_UserSchema, { name: 'alice' });
    impl.getUserInfo(userInfo);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.getUserInfo({ userInfo }));
  });

  it('getUserInfoFailed dispatches the user name and code', () => {
    const { impl, dispatch } = setup();
    impl.getUserInfoFailed('alice', 34);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.getUserInfoFailed({ userName: 'alice', responseCode: 34 }));
  });

  it('privateMessageFailed dispatches privateMessageFailed with the response code', () => {
    const { impl, dispatch } = setup();
    impl.privateMessageFailed('alice', 'hi', 18);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.privateMessageFailed({ userName: 'alice', message: 'hi', responseCode: 18 }));
  });

  it('getGamesOfUserPending / getGamesOfUserFailed dispatch the request lifecycle actions', () => {
    const { impl, dispatch } = setup();
    impl.getGamesOfUserPending('alice');
    impl.getGamesOfUserFailed('alice', 6, WebsocketTypes.CommandFailure.Disconnected);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.gamesOfUserRequested({ userName: 'alice' }));
    expect(dispatch).toHaveBeenCalledWith(ServerActions.gamesOfUserFailed({
      userName: 'alice', responseCode: 6, failure: WebsocketTypes.CommandFailure.Disconnected,
    }));
  });

  it('getGamesOfUser maps method name to gamesOfUser action', () => {
    const { impl, dispatch } = setup();
    const response = create(Response_GetGamesOfUserSchema, {});
    impl.getGamesOfUser('alice', response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.gamesOfUser({ userName: 'alice', response }));
  });

  it('gameJoined dispatches a GameActions action with the data', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_GameJoinedSchema, { gameId: 7 });
    impl.gameJoined(data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.gameJoined({ data }));
  });

  it('notifyUser', () => {
    const { impl, dispatch } = setup();
    const notification = create(Event_NotifyUserSchema, {});
    impl.notifyUser(notification);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.notifyUser({ notification }));
  });

  it.each([
    Event_NotifyUser_NotificationType.REPORT_RESOLVED,
    Event_NotifyUser_NotificationType.REPORT_COMMENT,
  ])('notifyUser lands 3.1 report notification type %s in server.notifications', (type) => {
    const { store, impl } = setup();
    const notification = create(Event_NotifyUserSchema, { type, customTitle: 'Report #3', customContent: 'Resolved' });
    impl.notifyUser(notification);
    expect(store.getState().server.notifications).toEqual([notification]);
  });

  it('playerPropertiesChanged dispatches a GameActions action when playerProperties is set', () => {
    const { impl, dispatch } = setup();
    const playerProperties = create(ServerInfo_PlayerPropertiesSchema, { playerId: 3 });
    const payload = create(Event_PlayerPropertiesChangedSchema, { playerProperties });
    impl.playerPropertiesChanged(7, 3, payload);
    expect(dispatch).toHaveBeenCalledWith(
      GameActions.playerPropertiesChanged({ gameId: 7, playerId: 3, properties: playerProperties }),
    );
  });

  it('playerPropertiesChanged dispatches nothing when payload.playerProperties is unset', () => {
    const { impl, dispatch } = setup();
    const payload = create(Event_PlayerPropertiesChangedSchema, {});
    impl.playerPropertiesChanged(7, 3, payload);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('serverShutdown', () => {
    const { impl, dispatch } = setup();
    const data = create(Event_ServerShutdownSchema, {});
    impl.serverShutdown(data);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.serverShutdown({ data }));
  });

  it('stamps private messages at receipt before dispatching to the reducer', () => {
    const { impl, dispatch } = setup();
    const messageData = create(Event_UserMessageSchema, {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(123456789);
    try {
      impl.userMessage(messageData);
      expect(dispatch).toHaveBeenCalledWith(ServerActions.userMessage({ messageData, timeReceived: 123456789 }));
    } finally {
      now.mockRestore();
    }
  });

  it('addToList', () => {
    const { impl, dispatch } = setup();
    impl.addToList('buddy', 'alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.addToList({ list: 'buddy', userName: 'alice' }));
  });

  it('removeFromList', () => {
    const { impl, dispatch } = setup();
    impl.removeFromList('buddy', 'alice');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.removeFromList({ list: 'buddy', userName: 'alice' }));
  });

  it('deleteServerDeck maps method name to deckDelete action', () => {
    const { impl, dispatch } = setup();
    impl.deleteServerDeck(42);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckDelete({ deckId: 42 }));
  });

  it('updateServerDecks maps method name to backendDecks action', () => {
    const { impl, dispatch } = setup();
    const deckList = create(Response_DeckListSchema, {});
    impl.updateServerDecks(deckList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.backendDecks({ deckList }));
  });

  it('uploadServerDeck maps method name to deckUpload action', () => {
    const { impl, dispatch } = setup();
    const treeItem = create(ServerInfo_DeckStorage_TreeItemSchema, { name: 'deck1' });
    impl.uploadServerDeck('/folder', treeItem);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckUpload({ path: '/folder', treeItem }));
  });

  it('updateServerDeck maps method name to deckUpdated action', () => {
    const { impl, dispatch } = setup();
    const treeItem = create(ServerInfo_DeckStorage_TreeItemSchema, { id: 4, name: 'deck1' });
    impl.updateServerDeck(4, treeItem);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckUpdated({ deckId: 4, treeItem }));
  });

  it('updateServerDeckFailed maps method name to deckUpdateFailed action', () => {
    const { impl, dispatch } = setup();
    impl.updateServerDeckFailed(4, 19);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckUpdateFailed({ deckId: 4, responseCode: 19, failure: undefined }));
  });

  it('createServerDeckDir maps method name to deckNewDir action', () => {
    const { impl, dispatch } = setup();
    impl.createServerDeckDir('/parent', 'newdir');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckNewDir({ path: '/parent', dirName: 'newdir' }));
    impl.createServerDeckDir('/parent', 'newdir', 'req-1');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckNewDir({ path: '/parent', dirName: 'newdir', requestId: 'req-1' }));
  });

  it('deckNewDirFailed dispatches the failure with its request identity', () => {
    const { impl, dispatch } = setup();
    impl.deckNewDirFailed('/parent', 'newdir', 18, undefined, 'req-2');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckNewDirFailed({
      path: '/parent', dirName: 'newdir', responseCode: 18, failure: undefined, requestId: 'req-2',
    }));
  });

  it('deleteServerDeckDir maps method name to deckDelDir action', () => {
    const { impl, dispatch } = setup();
    impl.deleteServerDeckDir('/folder');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckDelDir({ path: '/folder' }));
  });

  it('replayList', () => {
    const { impl, dispatch } = setup();
    const matchList = [create(ServerInfo_ReplayMatchSchema, { gameId: 1 })];
    impl.replayList(matchList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayList({ matchList }));
  });

  it('replayAdded', () => {
    const { impl, dispatch } = setup();
    const matchInfo = create(ServerInfo_ReplayMatchSchema, { gameId: 1 });
    impl.replayAdded(matchInfo);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayAdded({ matchInfo }));
  });

  it('replayModifyMatch', () => {
    const { impl, dispatch } = setup();
    impl.replayModifyMatch(1, true);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayModifyMatch({ gameId: 1, doNotHide: true }));
  });

  it('replayDeleteMatch', () => {
    const { impl, dispatch } = setup();
    impl.replayDeleteMatch(1);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayDeleteMatch({ gameId: 1 }));
  });

  it('downloadServerDeck unwraps response.deck into the deckDownloaded payload', () => {
    const { impl, dispatch } = setup();
    const deck = 'parsed deck content';
    const response = create(Response_DeckDownloadSchema, { deck });
    impl.downloadServerDeck(42, response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckDownloaded({ deckId: 42, deck }));
  });

  it('replayDownloaded unwraps response.replayData into the replayDownloaded payload', () => {
    const { impl, dispatch } = setup();
    const replayData = new Uint8Array([4, 5, 6]);
    const response = create(Response_ReplayDownloadSchema, { replayData });
    impl.replayDownloaded(1, response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayDownloaded({ replayId: 1, replayData }));
  });

  it('commandFailed dispatches sessionCommandFailed with the command, code and target', () => {
    const { impl, dispatch } = setup();
    impl.commandFailed('deckShareList', Response_ResponseCode.RespNameNotFound, 'tok');
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.sessionCommandFailed({ command: 'deckShareList', responseCode: Response_ResponseCode.RespNameNotFound, target: 'tok' }),
    );
  });

  it('deckListFailed dispatches deckListFailed with the code and transport reason', () => {
    const { impl, dispatch } = setup();
    impl.deckListFailed(-1, WebsocketTypes.CommandFailure.Timeout);
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.deckListFailed({ responseCode: -1, failure: WebsocketTypes.CommandFailure.Timeout }),
    );
  });

  it('replayListFailed dispatches replayListFailed with the code and transport reason', () => {
    const { impl, dispatch } = setup();
    impl.replayListFailed(-1, WebsocketTypes.CommandFailure.Disconnected);
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.replayListFailed({ responseCode: -1, failure: WebsocketTypes.CommandFailure.Disconnected }),
    );
  });

  it('deckDownloadFailed dispatches deckDownloadFailed keyed by deckId', () => {
    const { impl, dispatch } = setup();
    impl.deckDownloadFailed(42, 15);
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.deckDownloadFailed({ deckId: 42, responseCode: 15, failure: undefined }),
    );
  });

  it('deckUploadFailed dispatches deckUploadFailed with the path', () => {
    const { impl, dispatch } = setup();
    impl.deckUploadFailed('', -1, WebsocketTypes.CommandFailure.Disconnected);
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.deckUploadFailed({ path: '', responseCode: -1, failure: WebsocketTypes.CommandFailure.Disconnected }),
    );
  });
});

describe('SessionResponseImpl reports', () => {
  it('reportMyList dispatches reportMyList', () => {
    const { impl, dispatch } = setup();
    const reports = [create(ServerInfo_ReportSchema, { reportId: 3 })];
    impl.reportMyList(reports);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.reportMyList({ reports }));
  });

  it('reportDetails lands the full report in server.reports.details', () => {
    const { store, impl } = setup();
    const report = create(ServerInfo_ReportSchema, { reportId: 3, chatLog: 'log' });
    impl.reportDetails(report);
    expect(store.getState().server.reports.details[3]).toBe(report);
  });

  it.each([
    Event_NotifyUser_NotificationType.REPORT_RESOLVED,
    Event_NotifyUser_NotificationType.REPORT_COMMENT,
  ])('notifyUser also raises reportNotified for report notification type %s', (type) => {
    const { store, impl } = setup();
    const notification = create(Event_NotifyUserSchema, { type, customTitle: 'Report Resolved', customContent: 'Done' });
    impl.notifyUser(notification);
    expect(store.getState().server.reports.lastNotice).toEqual({ notification });
  });

  it('notifyUser does not raise reportNotified for other notification types', () => {
    const { store, impl } = setup();
    impl.notifyUser(create(Event_NotifyUserSchema, { type: Event_NotifyUser_NotificationType.PROMOTED }));
    expect(store.getState().server.reports.lastNotice).toBeNull();
  });
});

describe('SessionResponseImpl deck sharing (#7241)', () => {
  it('deckShareCreated dispatches the created share', () => {
    const { impl, dispatch } = setup();
    const share = create(Response_DeckShareCreateSchema, { token: 'tok', expiresAt: 100n, itemCount: 1 });
    impl.deckShareCreated(share);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckShareCreated({ share }));
  });

  it('deckShareListed dispatches the bundle keyed by token', () => {
    const { impl, dispatch } = setup();
    const share = create(Response_DeckShareListSchema, { name: 'Cube' });
    impl.deckShareListed('tok', share);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckShareListed({ token: 'tok', share }));
  });

  it('deckShareDownloaded dispatches the deck text', () => {
    const { impl, dispatch } = setup();
    impl.deckShareDownloaded('tok', 3, '<deck/>');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckShareDownloaded({ token: 'tok', itemId: 3, deck: '<deck/>' }));
  });

  it('deckSharesMine and deckShareRemoved dispatch the share list changes', () => {
    const { impl, dispatch } = setup();
    const shares = [create(ServerInfo_DeckShareSummarySchema, { id: 4 })];
    impl.deckSharesMine(shares);
    impl.deckShareRemoved(4);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckSharesMine({ shares }));
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckShareRemoved({ shareId: 4 }));
  });

  it('otherUserDecks dispatches publicDecks keyed by user', () => {
    const { impl, dispatch } = setup();
    const deckList = create(Response_DeckListSchema, {});
    impl.otherUserDecks('bob', deckList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.publicDecks({ userName: 'bob', deckList }));
  });

  it('deckVisibilityChanged dispatches the target and the new bit', () => {
    const { impl, dispatch } = setup();
    impl.deckVisibilityChanged({ folderPath: 'cubes', isPublic: true });
    expect(dispatch).toHaveBeenCalledWith(
      ServerActions.deckVisibilityChanged({ deckId: undefined, folderPath: 'cubes', isPublic: true }),
    );
  });

  it('deckVisibilityChanged defaults an omitted visibility bit to private', () => {
    const { impl, dispatch } = setup();
    try {
      impl.deckVisibilityChanged({ deckId: 8 });
      expect(dispatch.mock.calls).toEqual([[
        ServerActions.deckVisibilityChanged({ deckId: 8, folderPath: undefined, isPublic: false }),
      ]]);
    } finally {
      dispatch.mockRestore();
    }
  });

  it('publicDeckDownloaded dispatches the deck text', () => {
    const { impl, dispatch } = setup();
    impl.publicDeckDownloaded(7, '<deck/>');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.publicDeckDownloaded({ deckId: 7, deck: '<deck/>' }));
  });

});
