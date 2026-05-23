import type { Store } from '@reduxjs/toolkit';
import { Data } from '../types';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { Actions as ServerActions } from '../store/server/server.actions';
import { Actions as GameActions } from '../store/games/game.actions';

type LoginSuccess = WebsocketTypes.LoginSuccessContext;
type PendingActivation = WebsocketTypes.PendingActivationContext;

export class SessionResponseImpl implements WebsocketTypes.ISessionResponse {
  constructor(private store: Store) {}

  initialized(): void {
    this.store.dispatch(ServerActions.initialized());
  }

  connectionAttempted(): void {
    this.store.dispatch(ServerActions.connectionAttempted());
  }

  clearStore(): void {
    this.store.dispatch(ServerActions.clearStore());
  }

  loginSuccessful(options: LoginSuccess): void {
    this.store.dispatch(ServerActions.loginSuccessful({ options }));
  }

  loginFailed(): void {
    this.store.dispatch(ServerActions.loginFailed());
  }

  connectionFailed(): void {
    this.store.dispatch(ServerActions.connectionFailed());
  }

  testConnectionSuccessful(supportsHashedPassword: boolean): void {
    this.store.dispatch(ServerActions.testConnectionSuccessful({ supportsHashedPassword }));
  }

  testConnectionFailed(): void {
    this.store.dispatch(ServerActions.testConnectionFailed());
  }

  updateBuddyList(buddyList: Data.ServerInfo_User[]): void {
    this.store.dispatch(ServerActions.updateBuddyList({ buddyList }));
  }

  addToBuddyList(user: Data.ServerInfo_User): void {
    this.store.dispatch(ServerActions.addToBuddyList({ user }));
  }

  removeFromBuddyList(userName: string): void {
    this.store.dispatch(ServerActions.removeFromBuddyList({ userName }));
  }

  updateIgnoreList(ignoreList: Data.ServerInfo_User[]): void {
    this.store.dispatch(ServerActions.updateIgnoreList({ ignoreList }));
  }

  addToIgnoreList(user: Data.ServerInfo_User): void {
    this.store.dispatch(ServerActions.addToIgnoreList({ user }));
  }

  removeFromIgnoreList(userName: string): void {
    this.store.dispatch(ServerActions.removeFromIgnoreList({ userName }));
  }

  updateInfo(name: string, version: string): void {
    this.store.dispatch(ServerActions.updateInfo({ info: { name, version } }));
  }

  updateStatus(state: WebsocketTypes.StatusEnum, description: string): void {
    this.store.dispatch(ServerActions.updateStatus({ status: { state, description } }));
  }

  updateUser(user: Data.ServerInfo_User): void {
    this.store.dispatch(ServerActions.updateUser({ user }));
  }

  updateUsers(users: Data.ServerInfo_User[]): void {
    this.store.dispatch(ServerActions.updateUsers({ users }));
  }

  userJoined(user: Data.ServerInfo_User): void {
    this.store.dispatch(ServerActions.userJoined({ user }));
  }

  userLeft(userName: string): void {
    this.store.dispatch(ServerActions.userLeft({ name: userName }));
  }

  serverMessage(message: string): void {
    this.store.dispatch(ServerActions.serverMessage({ message }));
  }

  accountAwaitingActivation(options: PendingActivation): void {
    this.store.dispatch(ServerActions.accountAwaitingActivation({ options }));
  }

  accountActivationSuccess(): void {
    this.store.dispatch(ServerActions.accountActivationSuccess());
  }

  accountActivationFailed(): void {
    this.store.dispatch(ServerActions.accountActivationFailed());
  }

  registrationRequiresEmail(): void {
    this.store.dispatch(ServerActions.registrationRequiresEmail());
  }

  registrationSuccess(): void {
    this.store.dispatch(ServerActions.registrationSuccess());
  }

  registrationFailed(reason: string, endTime?: number): void {
    this.store.dispatch(ServerActions.registrationFailed({ reason, endTime }));
  }

  registrationEmailError(error: string): void {
    this.store.dispatch(ServerActions.registrationEmailError({ error }));
  }

  registrationPasswordError(error: string): void {
    this.store.dispatch(ServerActions.registrationPasswordError({ error }));
  }

  registrationUserNameError(error: string): void {
    this.store.dispatch(ServerActions.registrationUserNameError({ error }));
  }

  resetPasswordChallenge(): void {
    this.store.dispatch(ServerActions.resetPasswordChallenge());
  }

  resetPassword(): void {
    this.store.dispatch(ServerActions.resetPassword());
  }

  resetPasswordSuccess(): void {
    this.store.dispatch(ServerActions.resetPasswordSuccess());
  }

  resetPasswordFailed(): void {
    this.store.dispatch(ServerActions.resetPasswordFailed());
  }

  accountPasswordChange(): void {
    this.store.dispatch(ServerActions.accountPasswordChange());
  }

  accountEditChanged(realName?: string, email?: string, country?: string): void {
    this.store.dispatch(ServerActions.accountEditChanged({ user: { realName, email, country } }));
  }

  accountImageChanged(avatarBmp: Uint8Array): void {
    this.store.dispatch(ServerActions.accountImageChanged({ user: { avatarBmp } }));
  }

  getUserInfo(userInfo: Data.ServerInfo_User): void {
    this.store.dispatch(ServerActions.getUserInfo({ userInfo }));
  }

  getGamesOfUser(userName: string, response: Data.Response_GetGamesOfUser): void {
    this.store.dispatch(ServerActions.gamesOfUser({ userName, response }));
  }

  gameJoined(gameJoinedData: Data.Event_GameJoined): void {
    this.store.dispatch(GameActions.gameJoined({ data: gameJoinedData }));
  }

  notifyUser(notification: Data.Event_NotifyUser): void {
    this.store.dispatch(ServerActions.notifyUser({ notification }));
  }

  playerPropertiesChanged(gameId: number, playerId: number, payload: Data.Event_PlayerPropertiesChanged): void {
    if (payload.playerProperties) {
      this.store.dispatch(GameActions.playerPropertiesChanged({ gameId, playerId, properties: payload.playerProperties }));
    }
  }

  serverShutdown(data: Data.Event_ServerShutdown): void {
    this.store.dispatch(ServerActions.serverShutdown({ data }));
  }

  userMessage(messageData: Data.Event_UserMessage): void {
    this.store.dispatch(ServerActions.userMessage({ messageData }));
  }

  addToList(list: string, userName: string): void {
    this.store.dispatch(ServerActions.addToList({ list, userName }));
  }

  removeFromList(list: string, userName: string): void {
    this.store.dispatch(ServerActions.removeFromList({ list, userName }));
  }

  deleteServerDeck(deckId: number): void {
    this.store.dispatch(ServerActions.deckDelete({ deckId }));
  }

  updateServerDecks(deckList: Data.Response_DeckList): void {
    this.store.dispatch(ServerActions.backendDecks({ deckList }));
  }

  uploadServerDeck(path: string, treeItem: Data.ServerInfo_DeckStorage_TreeItem): void {
    this.store.dispatch(ServerActions.deckUpload({ path, treeItem }));
  }

  createServerDeckDir(path: string, dirName: string): void {
    this.store.dispatch(ServerActions.deckNewDir({ path, dirName }));
  }

  deleteServerDeckDir(path: string): void {
    this.store.dispatch(ServerActions.deckDelDir({ path }));
  }

  replayList(matchList: Data.ServerInfo_ReplayMatch[]): void {
    this.store.dispatch(ServerActions.replayList({ matchList }));
  }

  replayAdded(matchInfo: Data.ServerInfo_ReplayMatch): void {
    this.store.dispatch(ServerActions.replayAdded({ matchInfo }));
  }

  replayModifyMatch(gameId: number, doNotHide: boolean): void {
    this.store.dispatch(ServerActions.replayModifyMatch({ gameId, doNotHide }));
  }

  replayDeleteMatch(gameId: number): void {
    this.store.dispatch(ServerActions.replayDeleteMatch({ gameId }));
  }

  downloadServerDeck(deckId: number, response: Data.Response_DeckDownload): void {
    this.store.dispatch(ServerActions.deckDownloaded({ deckId, deck: response.deck }));
  }

  replayDownloaded(replayId: number, response: Data.Response_ReplayDownload): void {
    this.store.dispatch(ServerActions.replayDownloaded({ replayId, replayData: response.replayData }));
  }
}
