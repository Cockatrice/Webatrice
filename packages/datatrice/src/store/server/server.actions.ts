import { createAction } from '@reduxjs/toolkit';
import type { Response_DeckShareCreate, Response_DeckShareList } from '@cockatrice/sockatrice/generated';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';

import { serverSlice } from './server.reducer';
import type { CommandFailedPayload, SessionCommandFailedPayload } from './server.interfaces';

const SignalActions = {
  accountAwaitingActivation: createAction<{ options: WebsocketTypes.PendingActivationContext }>('server/accountAwaitingActivation'),
  accountActivationFailed: createAction<{ failure: WebsocketTypes.CommandFailure } | undefined>('server/accountActivationFailed'),
  accountActivationSuccess: createAction('server/accountActivationSuccess'),
  loginSuccessful: createAction<{ options: WebsocketTypes.LoginSuccessContext }>('server/loginSuccessful'),
  connectionFailed: createAction('server/connectionFailed'),
  registrationRequiresEmail: createAction('server/registrationRequiresEmail'),
  registrationSuccess: createAction('server/registrationSuccess'),
  registrationEmailError: createAction<{ error: string }>('server/registrationEmailError'),
  registrationPasswordError: createAction<{ error: string }>('server/registrationPasswordError'),
  registrationUserNameError: createAction<{ error: string }>('server/registrationUserNameError'),
  resetPassword: createAction('server/resetPassword'),
  resetPasswordFailed: createAction('server/resetPasswordFailed'),
  resetPasswordChallenge: createAction('server/resetPasswordChallenge'),
  resetPasswordSuccess: createAction('server/resetPasswordSuccess'),
  reloadConfig: createAction('server/reloadConfig'),
  shutdownServer: createAction('server/shutdownServer'),
  updateServerMessage: createAction('server/updateServerMessage'),
  accountPasswordChange: createAction('server/accountPasswordChange'),
  addToList: createAction<{ list: string; userName: string }>('server/addToList'),
  removeFromList: createAction<{ list: string; userName: string }>('server/removeFromList'),
  grantReplayAccess: createAction<{ replayId: number; moderatorName: string }>('server/grantReplayAccess'),
  forceActivateUser: createAction<{ usernameToActivate: string; moderatorName: string }>('server/forceActivateUser'),
  getUserInfoFailed: createAction<{ userName: string; responseCode: number; requestId?: string }>('server/getUserInfoFailed'),
  moderatorCommandFailed: createAction<CommandFailedPayload & { command: WebsocketTypes.ModeratorCommandName; target: string }>(
    'server/moderatorCommandFailed'
  ),
  sessionCommandFailed: createAction<SessionCommandFailedPayload>('server/sessionCommandFailed'),
  adminCommandFailed: createAction<CommandFailedPayload & { command: WebsocketTypes.AdminCommandName; target: string }>(
    'server/adminCommandFailed'
  ),
  developerCommandFailed: createAction<CommandFailedPayload & { command: WebsocketTypes.DeveloperCommandName; target: string }>(
    'server/developerCommandFailed'
  ),
  deckListFailed: createAction<CommandFailedPayload>('server/deckListFailed'),
  deckDownloadFailed: createAction<CommandFailedPayload & { deckId: number }>('server/deckDownloadFailed'),
  deckUploadFailed: createAction<CommandFailedPayload & { path: string; requestId?: string }>('server/deckUploadFailed'),
  deckNewDirFailed: createAction<CommandFailedPayload & { path: string; dirName: string }>('server/deckNewDirFailed'),
  replayListFailed: createAction<CommandFailedPayload>('server/replayListFailed'),
  deckUpdateFailed: createAction<CommandFailedPayload & { deckId: number }>('server/deckUpdateFailed'),
  deckShareCreated: createAction<{ share: Response_DeckShareCreate; requestId?: string }>('server/deckShareCreated'),
  deckShareListed: createAction<{ token: string; share: Response_DeckShareList }>('server/deckShareListed'),
  deckShareDownloaded: createAction<{ token: string; itemId: number; deck: string }>('server/deckShareDownloaded'),
  publicDeckDownloaded: createAction<{ deckId: number; deck: string }>('server/publicDeckDownloaded'),
};

export const Actions = { ...serverSlice.actions, ...SignalActions };

export type ServerAction = ReturnType<typeof Actions[keyof typeof Actions]>;
