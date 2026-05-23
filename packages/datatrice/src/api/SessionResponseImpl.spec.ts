import { create } from '@bufbuild/protobuf';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { createStore } from '../store/createStore';
import { Data } from '../types';
import { Actions as ServerActions } from '../store/server/server.actions';
import { Actions as GameActions } from '../store/games/game.actions';
import { SessionResponseImpl } from './SessionResponseImpl';

function setup() {
  const store = createStore();
  const dispatch = vi.spyOn(store, 'dispatch');
  return { store, impl: new SessionResponseImpl(store), dispatch };
}

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

  it('connectionFailed', () => {
    const { impl, dispatch } = setup();
    impl.connectionFailed();
    expect(dispatch).toHaveBeenCalledWith(ServerActions.connectionFailed());
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
    const buddyList = [create(Data.ServerInfo_UserSchema, { name: 'alice' })];
    impl.updateBuddyList(buddyList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateBuddyList({ buddyList }));
  });

  it('addToBuddyList', () => {
    const { impl, dispatch } = setup();
    const user = create(Data.ServerInfo_UserSchema, { name: 'alice' });
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
    const ignoreList = [create(Data.ServerInfo_UserSchema, { name: 'bob' })];
    impl.updateIgnoreList(ignoreList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateIgnoreList({ ignoreList }));
  });

  it('addToIgnoreList', () => {
    const { impl, dispatch } = setup();
    const user = create(Data.ServerInfo_UserSchema, { name: 'bob' });
    impl.addToIgnoreList(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.addToIgnoreList({ user }));
  });

  it('removeFromIgnoreList', () => {
    const { impl, dispatch } = setup();
    impl.removeFromIgnoreList('bob');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.removeFromIgnoreList({ userName: 'bob' }));
  });

  it('updateInfo packs name + version into an info object', () => {
    const { impl, dispatch } = setup();
    impl.updateInfo('Servatrice', '2.7.0');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateInfo({ info: { name: 'Servatrice', version: '2.7.0' } }));
  });

  it('updateUser', () => {
    const { impl, dispatch } = setup();
    const user = create(Data.ServerInfo_UserSchema, { name: 'alice' });
    impl.updateUser(user);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateUser({ user }));
  });

  it('updateUsers', () => {
    const { impl, dispatch } = setup();
    const users = [create(Data.ServerInfo_UserSchema, { name: 'alice' })];
    impl.updateUsers(users);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.updateUsers({ users }));
  });

  it('userJoined', () => {
    const { impl, dispatch } = setup();
    const user = create(Data.ServerInfo_UserSchema, { name: 'alice' });
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
    const userInfo = create(Data.ServerInfo_UserSchema, { name: 'alice' });
    impl.getUserInfo(userInfo);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.getUserInfo({ userInfo }));
  });

  it('getGamesOfUser maps method name to gamesOfUser action', () => {
    const { impl, dispatch } = setup();
    const response = create(Data.Response_GetGamesOfUserSchema, {});
    impl.getGamesOfUser('alice', response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.gamesOfUser({ userName: 'alice', response }));
  });

  it('gameJoined dispatches a GameActions action with the data', () => {
    const { impl, dispatch } = setup();
    const data = create(Data.Event_GameJoinedSchema, { gameId: 7 });
    impl.gameJoined(data);
    expect(dispatch).toHaveBeenCalledWith(GameActions.gameJoined({ data }));
  });

  it('notifyUser', () => {
    const { impl, dispatch } = setup();
    const notification = create(Data.Event_NotifyUserSchema, {});
    impl.notifyUser(notification);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.notifyUser({ notification }));
  });

  it('playerPropertiesChanged dispatches a GameActions action when playerProperties is set', () => {
    const { impl, dispatch } = setup();
    const playerProperties = create(Data.ServerInfo_PlayerPropertiesSchema, { playerId: 3 });
    const payload = create(Data.Event_PlayerPropertiesChangedSchema, { playerProperties });
    impl.playerPropertiesChanged(7, 3, payload);
    expect(dispatch).toHaveBeenCalledWith(
      GameActions.playerPropertiesChanged({ gameId: 7, playerId: 3, properties: playerProperties }),
    );
  });

  it('playerPropertiesChanged dispatches nothing when payload.playerProperties is unset', () => {
    const { impl, dispatch } = setup();
    const payload = create(Data.Event_PlayerPropertiesChangedSchema, {});
    impl.playerPropertiesChanged(7, 3, payload);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('serverShutdown', () => {
    const { impl, dispatch } = setup();
    const data = create(Data.Event_ServerShutdownSchema, {});
    impl.serverShutdown(data);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.serverShutdown({ data }));
  });

  it('userMessage', () => {
    const { impl, dispatch } = setup();
    const messageData = create(Data.Event_UserMessageSchema, {});
    impl.userMessage(messageData);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.userMessage({ messageData }));
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
    const deckList = create(Data.Response_DeckListSchema, {});
    impl.updateServerDecks(deckList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.backendDecks({ deckList }));
  });

  it('uploadServerDeck maps method name to deckUpload action', () => {
    const { impl, dispatch } = setup();
    const treeItem = create(Data.ServerInfo_DeckStorage_TreeItemSchema, { name: 'deck1' });
    impl.uploadServerDeck('/folder', treeItem);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckUpload({ path: '/folder', treeItem }));
  });

  it('createServerDeckDir maps method name to deckNewDir action', () => {
    const { impl, dispatch } = setup();
    impl.createServerDeckDir('/parent', 'newdir');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckNewDir({ path: '/parent', dirName: 'newdir' }));
  });

  it('deleteServerDeckDir maps method name to deckDelDir action', () => {
    const { impl, dispatch } = setup();
    impl.deleteServerDeckDir('/folder');
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckDelDir({ path: '/folder' }));
  });

  it('replayList', () => {
    const { impl, dispatch } = setup();
    const matchList = [create(Data.ServerInfo_ReplayMatchSchema, { gameId: 1 })];
    impl.replayList(matchList);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayList({ matchList }));
  });

  it('replayAdded', () => {
    const { impl, dispatch } = setup();
    const matchInfo = create(Data.ServerInfo_ReplayMatchSchema, { gameId: 1 });
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
    const response = create(Data.Response_DeckDownloadSchema, { deck });
    impl.downloadServerDeck(42, response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.deckDownloaded({ deckId: 42, deck }));
  });

  it('replayDownloaded unwraps response.replayData into the replayDownloaded payload', () => {
    const { impl, dispatch } = setup();
    const replayData = new Uint8Array([4, 5, 6]);
    const response = create(Data.Response_ReplayDownloadSchema, { replayData });
    impl.replayDownloaded(1, response);
    expect(dispatch).toHaveBeenCalledWith(ServerActions.replayDownloaded({ replayId: 1, replayData }));
  });
});
