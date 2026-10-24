// Shared mock setup for session command tests

vi.mock('../../WebClient');

vi.mock('../../utils', async () => {
  const { makeUtilsMock } = await import('../../__mocks__/sessionCommandMocks');
  return makeUtilsMock();
});

// Mock session commands barrel to allow cross-command calls while keeping real implementations
vi.mock('./', async () => {
  const actual = await vi.importActual('./');
  const { makeSessionBarrelMock } = await import('../../__mocks__/sessionCommandMocks');
  return { ...(actual as Record<string, unknown>), ...makeSessionBarrelMock() };
});

import { Mock } from 'vitest';
import { isFieldSet } from '@bufbuild/protobuf';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import { CommandFailure } from '../../types/CommandFailure';
import { StatusEnum } from '../../types/StatusEnum';
import { hashPassword, generateSalt, passwordHashAvailable, passwordSaltSupported } from '../../utils';

import { accountEdit } from './accountEdit';
import { accountImage } from './accountImage';
import { accountPassword } from './accountPassword';
import { deckDel } from './deckDel';
import { deckDelDir } from './deckDelDir';
import { deckDownload } from './deckDownload';
import { deckList } from './deckList';
import { deckNewDir } from './deckNewDir';
import { deckUpdate } from './deckUpdate';
import { deckUpload } from './deckUpload';
import { disconnect } from './disconnect';
import { getGamesOfUser } from './getGamesOfUser';
import { getUserInfo } from './getUserInfo';
import { joinRoom } from './joinRoom';
import { _resetPendingRoomJoins } from './pendingRoomJoins';
import { listRooms } from './listRooms';
import { listUsers } from './listUsers';
import { message } from './message';
import { ping } from './ping';
import { replayDeleteMatch } from './replayDeleteMatch';
import { replayDownload } from './replayDownload';
import { replayList } from './replayList';
import { replayModifyMatch } from './replayModifyMatch';
import { addToList, addToBuddyList, addToIgnoreList } from './addToList';
import { removeFromList, removeFromBuddyList, removeFromIgnoreList } from './removeFromList';
import { replayGetCode } from './replayGetCode';
import { replaySubmitCode } from './replaySubmitCode';
import {
  Command_AccountEdit_ext,
  Command_AccountEditSchema,
  Command_AccountPasswordSchema,
  Command_AccountImage_ext,
  Command_AccountPassword_ext,
  Command_AddToList_ext,
  Command_DeckDel_ext,
  Command_DeckDelDir_ext,
  Command_DeckDownload_ext,
  Command_DeckList_ext,
  Command_DeckNewDir_ext,
  Command_DeckUpload_ext,
  Command_GetGamesOfUser_ext,
  Command_GetUserInfo_ext,
  Command_JoinRoom_ext,
  Command_LeaveRoom_ext,
  Command_ListRooms_ext,
  Command_ListUsers_ext,
  Command_Message_ext,
  Command_Ping_ext,
  Command_RemoveFromList_ext,
  Command_ReplayDeleteMatch_ext,
  Command_ReplayDownload_ext,
  Command_ReplayGetCode_ext,
  Command_ReplayList_ext,
  Command_ReplayModifyMatch_ext,
  Command_ReplaySubmitCode_ext,
  Response_DeckDownload_ext,
  Response_DeckList_ext,
  Response_ResponseCode,
  Response_DeckUpload_ext,
  Response_GetGamesOfUser_ext,
  Response_GetUserInfo_ext,
  Response_JoinRoom_ext,
  Response_ListUsers_ext,
  Response_ReplayDownload_ext,
  Response_ReplayGetCode_ext,
  Response_ReplayList_ext,
} from '../../generated';

const { invokeOnSuccess, invokeCallback, invokeResponseCode, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendSessionCommand as Mock,
  2
);

beforeEach(() => {
  _resetPendingRoomJoins();
  (hashPassword as Mock).mockResolvedValue('hashed_pw');
  (generateSalt as Mock).mockReturnValue('randSalt');
  (passwordSaltSupported as Mock).mockReturnValue(0);
});

describe('accountEdit', () => {
  it('sends Command_AccountEdit with correct params', () => {
    accountEdit({ passwordCheck: 'pw', realName: 'Alice', email: 'a@b.com', country: 'us' });
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_AccountEdit_ext,
      expect.objectContaining({ passwordCheck: 'pw', realName: 'Alice', email: 'a@b.com', country: 'us' }),
      expect.any(Object)
    );
  });

  it('leaves omitted fields unset so Servatrice does not touch them', () => {
    accountEdit({ realName: 'Alice', country: 'us' });
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(isFieldSet(cmd, Command_AccountEditSchema.field.realName)).toBe(true);
    expect(isFieldSet(cmd, Command_AccountEditSchema.field.email)).toBe(false);
    expect(isFieldSet(cmd, Command_AccountEditSchema.field.passwordCheck)).toBe(false);
  });

  it('reports the edit to the response layer and the caller on success', () => {
    const onEdited = vi.fn();
    accountEdit({ realName: 'Alice', email: 'a@b.com', country: 'us' }, onEdited);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountEditChanged).toHaveBeenCalledWith('Alice', 'a@b.com', 'us');
    expect(onEdited).toHaveBeenCalled();
  });

  it('hands the response code to the caller on failure', () => {
    const onFailure = vi.fn();
    accountEdit({ realName: 'Alice' }, undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespWrongPassword);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespWrongPassword, undefined);
    expect(WebClient.instance.response.session.accountEditChanged).not.toHaveBeenCalled();
  });

  it('still accepts the deprecated positional form', () => {
    accountEdit('pw', 'Alice', undefined, 'us');
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(cmd).toMatchObject({ passwordCheck: 'pw', realName: 'Alice', country: 'us' });
    expect(isFieldSet(cmd, Command_AccountEditSchema.field.email)).toBe(false);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountEditChanged).toHaveBeenCalledWith('Alice', undefined, 'us');
  });

  it('treats an empty passwordCheck in the deprecated form as absent', () => {
    accountEdit('', 'Alice');
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(isFieldSet(cmd, Command_AccountEditSchema.field.passwordCheck)).toBe(false);
  });
});

describe('accountImage', () => {
  it('sends Command_AccountImage', () => {
    const img = new Uint8Array([1, 2]);
    accountImage(img);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_AccountImage_ext, expect.objectContaining({ image: img }), expect.any(Object)
    );
  });

  it('reports the new image to the response layer and the caller on success', () => {
    const img = new Uint8Array([1, 2]);
    const onChanged = vi.fn();
    accountImage(img, onChanged);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountImageChanged).toHaveBeenCalledWith(img);
    expect(onChanged).toHaveBeenCalled();
  });

  it('hands the response code to the caller on failure', () => {
    const onFailure = vi.fn();
    accountImage(new Uint8Array(), undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespFunctionNotAllowed, undefined);
  });
});

describe('accountPassword', () => {
  afterEach(() => {
    WebClient.instance.serverSupportsPasswordHash = false;
  });

  it('sends only the plaintext new password to servers without password hashing', async () => {
    await accountPassword('old', 'newpassword');
    const [ext, cmd] = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0];
    expect(ext).toBe(Command_AccountPassword_ext);
    expect(cmd).toMatchObject({ oldPassword: 'old', newPassword: 'newpassword' });
    expect(isFieldSet(cmd, Command_AccountPasswordSchema.field.hashedNewPassword)).toBe(false);
    expect(hashPassword).not.toHaveBeenCalled();
  });

  it('sends only a freshly salted hash to servers that support password hashing', async () => {
    WebClient.instance.serverSupportsPasswordHash = true;
    await accountPassword('old', 'newpassword');
    expect(hashPassword).toHaveBeenCalledWith('randSalt', 'newpassword');
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(cmd).toMatchObject({ oldPassword: 'old', hashedNewPassword: 'hashed_pw' });
    expect(isFieldSet(cmd, Command_AccountPasswordSchema.field.newPassword)).toBe(false);
  });

  it('sends the plaintext when the client cannot hash (no Web Crypto outside a secure context)', async () => {
    WebClient.instance.serverSupportsPasswordHash = true;
    (passwordHashAvailable as Mock).mockReturnValueOnce(false);
    await accountPassword('old', 'newpassword');
    expect(hashPassword).not.toHaveBeenCalled();
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(cmd).toMatchObject({ oldPassword: 'old', newPassword: 'newpassword' });
    expect(isFieldSet(cmd, Command_AccountPasswordSchema.field.hashedNewPassword)).toBe(false);
  });

  it('reports the change to the response layer and the caller on success', async () => {
    const onChanged = vi.fn();
    await accountPassword('old', 'newpassword', onChanged);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountPasswordChange).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it('hands a timeout to the caller with its transport reason', async () => {
    const onFailure = vi.fn();
    await accountPassword('old', 'newpassword', undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespNotConnected, CommandFailure.Timeout);
  });

  it('hands the response code to the caller on failure', async () => {
    const onFailure = vi.fn();
    await accountPassword('old', 'newpassword', undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespPasswordTooShort);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespPasswordTooShort, undefined);
    expect(WebClient.instance.response.session.accountPasswordChange).not.toHaveBeenCalled();
  });

  it('still accepts the deprecated form with a caller-computed hash and sends it synchronously', () => {
    const result = accountPassword('old', '', 'callerHash');
    expect(result).toBeUndefined();
    const cmd = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0][1];
    expect(cmd).toMatchObject({ oldPassword: 'old', hashedNewPassword: 'callerHash' });
    expect(isFieldSet(cmd, Command_AccountPasswordSchema.field.newPassword)).toBe(false);
    expect(hashPassword).not.toHaveBeenCalled();
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountPasswordChange).toHaveBeenCalled();
  });
});

describe('deckDel', () => {
  it('sends Command_DeckDel', () => {
    deckDel(42);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckDel_ext,
      expect.objectContaining({ deckId: 42 }),
      expect.any(Object)
    );
  });

  it('calls deleteServerDeck on success', () => {
    deckDel(42);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.deleteServerDeck).toHaveBeenCalledWith(42);
  });
});

describe('deckDelDir', () => {
  it('sends Command_DeckDelDir', () => {
    deckDelDir('/path');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckDelDir_ext, expect.objectContaining({ path: '/path' }), expect.any(Object)
    );
  });

  it('calls deleteServerDeckDir on success', () => {
    deckDelDir('/path');
    invokeOnSuccess();
    expect(WebClient.instance.response.session.deleteServerDeckDir).toHaveBeenCalledWith('/path');
  });
});

describe('deckList', () => {
  it('sends Command_DeckList', () => {
    deckList();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckList_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_DeckList_ext })
    );
  });

  it('calls updateServerDecks on success', () => {
    deckList();
    const root = { items: [] };
    invokeOnSuccess({ root }, { responseCode: 0 });
    expect(WebClient.instance.response.session.updateServerDecks).toHaveBeenCalledWith({ root });
  });

  it('reports a failure to deckListFailed', () => {
    deckList();
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.session.deckListFailed).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected, CommandFailure.Disconnected,
    );
  });
});

describe('deckNewDir', () => {
  it('sends Command_DeckNewDir', () => {
    deckNewDir('/path', 'dir');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckNewDir_ext, expect.objectContaining({ path: '/path', dirName: 'dir' }), expect.any(Object)
    );
  });

  it('calls createServerDeckDir on success', () => {
    deckNewDir('/path', 'dir');
    invokeOnSuccess();
    expect(WebClient.instance.response.session.createServerDeckDir).toHaveBeenCalledWith('/path', 'dir');
  });

  it('carries the request identity on success and on failure', () => {
    deckNewDir('/path', 'dir', 'folder-a');
    invokeOnSuccess();
    expect(WebClient.instance.response.session.createServerDeckDir).toHaveBeenCalledWith('/path', 'dir', 'folder-a');
    deckNewDir('/path', 'dir', 'folder-b');
    invokeOnError(Response_ResponseCode.RespChatFlood, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.session.deckNewDirFailed).toHaveBeenCalledWith(
      '/path', 'dir', Response_ResponseCode.RespChatFlood, CommandFailure.Timeout, 'folder-b',
    );
  });
});

describe('deckUpload', () => {
  it('sends Command_DeckUpload', () => {
    deckUpload('/path', 1, 'content');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckUpload_ext,
      expect.objectContaining({ path: '/path', deckId: 1, deckList: 'content' }),
      expect.objectContaining({ responseExt: Response_DeckUpload_ext })
    );
  });

  it('calls uploadServerDeck on success', () => {
    deckUpload('/path', 1, 'content');
    const resp = { newFile: { id: 1 } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.uploadServerDeck).toHaveBeenCalledWith('/path', resp.newFile);
  });

  it('reports a failure to deckUploadFailed with the path', () => {
    deckUpload('/path', 1, 'content');
    invokeOnError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.session.deckUploadFailed).toHaveBeenCalledWith(
      '/path', Response_ResponseCode.RespContextError, undefined,
    );
  });
});

describe('deckUpdate', () => {
  it('sends Command_DeckUpload with the deck id and no path', () => {
    deckUpdate(7, 'content');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckUpload_ext,
      expect.objectContaining({ deckId: 7, deckList: 'content' }),
      expect.objectContaining({ responseExt: Response_DeckUpload_ext })
    );
  });

  it('calls updateServerDeck on success', () => {
    deckUpdate(7, 'content');
    const resp = { newFile: { id: 7, name: 'Renamed' } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.updateServerDeck).toHaveBeenCalledWith(7, resp.newFile);
  });

  it('calls updateServerDeckFailed on error', () => {
    deckUpdate(7, 'content');
    invokeOnError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.session.updateServerDeckFailed).toHaveBeenCalledWith(
      7, Response_ResponseCode.RespContextError, undefined,
    );
  });

  it('tolerates a response implementation without the deck update callbacks', () => {
    const session = WebClient.instance.response.session;
    const { updateServerDeck, updateServerDeckFailed } = session;
    delete session.updateServerDeck;
    delete session.updateServerDeckFailed;
    try {
      deckUpdate(7, 'content');
      expect(() => invokeOnSuccess({ newFile: { id: 7 } }, { responseCode: 0 })).not.toThrow();
      deckUpdate(7, 'content');
      expect(() => invokeOnError(19)).not.toThrow();
    } finally {
      session.updateServerDeck = updateServerDeck;
      session.updateServerDeckFailed = updateServerDeckFailed;
    }
  });
});

describe('disconnect', () => {
  it('calls WebClient.instance.disconnect', () => {
    disconnect();
    expect(WebClient.instance.disconnect).toHaveBeenCalled();
  });
});

describe('getGamesOfUser', () => {
  it('sends Command_GetGamesOfUser', () => {
    getGamesOfUser('alice');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_GetGamesOfUser_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_GetGamesOfUser_ext })
    );
  });

  it('calls getGamesOfUser on success', () => {
    getGamesOfUser('alice');
    const resp = { gameList: [] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.getGamesOfUser).toHaveBeenCalledWith('alice', resp);
  });

  it('marks the request pending before sending', () => {
    getGamesOfUser('alice');
    expect(WebClient.instance.response.session.getGamesOfUserPending).toHaveBeenCalledWith('alice');
  });

  it.each([
    Response_ResponseCode.RespNameNotFound,
    Response_ResponseCode.RespInIgnoreList,
    Response_ResponseCode.RespInternalError,
  ])('reports rejection %i with its response code', (code) => {
    getGamesOfUser('alice');
    invokeOnError(code);
    expect(WebClient.instance.response.session.getGamesOfUserFailed).toHaveBeenCalledWith('alice', code, undefined);
  });

  it('reports a request the server never answered with the transport reason', () => {
    getGamesOfUser('alice');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.session.getGamesOfUserFailed).toHaveBeenCalledWith(
      'alice', Response_ResponseCode.RespNotConnected, CommandFailure.Timeout,
    );
  });

  it('stays silent when it failed because the session ended, whose state is already reset', () => {
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    getGamesOfUser('alice');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.session.getGamesOfUserFailed).not.toHaveBeenCalled();
  });
});

describe('getUserInfo', () => {
  it('sends Command_GetUserInfo', () => {
    getUserInfo('alice');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_GetUserInfo_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_GetUserInfo_ext })
    );
  });

  it('calls getUserInfo on success', () => {
    getUserInfo('alice');
    const resp = { userInfo: { name: 'alice' } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.getUserInfo).toHaveBeenCalledWith(resp.userInfo);
  });

  it('reports the user name and code on failure', () => {
    getUserInfo('alice');
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.session.getUserInfoFailed).toHaveBeenCalledWith('alice', Response_ResponseCode.RespNameNotFound);
  });
});

describe('joinRoom', () => {
  it('sends Command_JoinRoom', () => {
    joinRoom(5);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_JoinRoom_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_JoinRoom_ext })
    );
  });

  it('calls WebClient.instance.response.room.joinRoom on success, as user-initiated', () => {
    joinRoom(5);
    const resp = { roomInfo: { roomId: 5 } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.room.joinRoom).toHaveBeenCalledWith(resp.roomInfo, true);
  });

  it('marks a successful auto-join as not user-initiated', () => {
    joinRoom(5, false);
    const resp = { roomInfo: { roomId: 5 } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.room.joinRoom).toHaveBeenCalledWith(resp.roomInfo, false);
  });

  it('marks an auto-join the user asked for while it was in flight as user-initiated', () => {
    joinRoom(5, false);
    joinRoom(5);
    const resp = { roomInfo: { roomId: 5 } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.room.joinRoom).toHaveBeenCalledWith(resp.roomInfo, true);
  });

  it.each([
    Response_ResponseCode.RespNameNotFound,
    Response_ResponseCode.RespUserLevelTooLow,
    Response_ResponseCode.RespInternalError,
  ])('reports a failed user-initiated join with response code %i', (code) => {
    joinRoom(5);
    invokeOnError(code);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledWith(5, code, undefined, true);
  });

  it('marks an autojoin failure as not user-initiated', () => {
    joinRoom(5, false);
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespNameNotFound, undefined, false,
    );
  });

  it('heals RespContextError once by leaving and rejoining the room', () => {
    const send = WebClient.instance.protobuf.sendSessionCommand as Mock;
    joinRoom(5);
    invokeResponseCode(Response_ResponseCode.RespContextError);

    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledWith(
      5, Command_LeaveRoom_ext, expect.any(Object), expect.any(Object),
    );
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toBe(Command_JoinRoom_ext);
    expect(WebClient.instance.response.room.joinRoomFailed).not.toHaveBeenCalled();

    const resp = { roomInfo: { roomId: 5 } };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.room.joinRoom).toHaveBeenCalledWith(resp.roomInfo, true);
  });

  it('surfaces RespContextError when the healing rejoin is rejected the same way', () => {
    joinRoom(5);
    invokeResponseCode(Response_ResponseCode.RespContextError);
    invokeResponseCode(Response_ResponseCode.RespContextError);

    expect(WebClient.instance.protobuf.sendRoomCommand).toHaveBeenCalledTimes(1);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespContextError, undefined, true,
    );
  });

  it('passes the transport reason when the server never answered', () => {
    joinRoom(5);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespNotConnected, CommandFailure.Timeout, true,
    );
  });

  it('stays silent when it failed because the session ended, whose state is already reset', () => {
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    joinRoom(5);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.room.joinRoomFailed).not.toHaveBeenCalled();
  });

  it('folds a join for a room whose join is in flight into the pending one', () => {
    joinRoom(5, false);
    joinRoom(5);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledTimes(1);

    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledWith(
      5, Response_ResponseCode.RespNameNotFound, undefined, true,
    );

    joinRoom(5);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledTimes(2);
  });
});

describe('listRooms (command)', () => {
  it('sends Command_ListRooms', () => {
    listRooms();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(Command_ListRooms_ext, expect.any(Object));
  });
});

describe('listUsers', () => {
  it('sends Command_ListUsers', () => {
    listUsers();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ListUsers_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ListUsers_ext })
    );
  });

  it('calls WebClient.instance.response.session.updateUsers with the user list on success', () => {
    listUsers();
    const resp = { userList: [{ name: 'Alice' }] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.updateUsers).toHaveBeenCalledWith([{ name: 'Alice' }]);
  });
});

describe('message', () => {
  it('sends Command_Message', () => {
    message('bob', 'hi');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_Message_ext, expect.objectContaining({ userName: 'bob', message: 'hi' }), expect.any(Object)
    );
  });

  it.each([
    Response_ResponseCode.RespInIgnoreList,
    Response_ResponseCode.RespNameNotFound,
    Response_ResponseCode.RespChatFlood,
  ])('reports rejection %i with the unsent text', (code) => {
    message('bob', 'hi');
    invokeResponseCode(code);
    expect(WebClient.instance.response.session.privateMessageFailed).toHaveBeenCalledWith('bob', 'hi', code);
  });

  it('reports a message the server never answered with the transport reason', () => {
    message('bob', 'hi');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.NotSent);
    expect(WebClient.instance.response.session.privateMessageFailed).toHaveBeenCalledWith(
      'bob', 'hi', Response_ResponseCode.RespNotConnected, CommandFailure.NotSent,
    );
  });

  it('keeps other server rejections silent', () => {
    message('bob', 'hi');
    invokeOnError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.session.privateMessageFailed).not.toHaveBeenCalled();
  });

  it('stays silent when it failed because the session ended, whose state is already reset', () => {
    WebClient.instance.status = StatusEnum.DISCONNECTED;
    message('bob', 'hi');
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(WebClient.instance.response.session.privateMessageFailed).not.toHaveBeenCalled();
  });
});

describe('ping', () => {
  it('sends Command_Ping', () => {
    const pingReceived = vi.fn();
    ping(pingReceived);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_Ping_ext, expect.any(Object), expect.any(Object)
    );
  });

  it('calls pingReceived via onResponse', () => {
    const pingReceived = vi.fn();
    ping(pingReceived);
    invokeCallback('onResponse', {});
    expect(pingReceived).toHaveBeenCalled();
  });
});

describe('replayDeleteMatch', () => {
  it('sends Command_ReplayDeleteMatch', () => {
    replayDeleteMatch(7);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplayDeleteMatch_ext,
      expect.objectContaining({ gameId: 7 }),
      expect.any(Object)
    );
  });

  it('calls replayDeleteMatch on success', () => {
    replayDeleteMatch(7);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.replayDeleteMatch).toHaveBeenCalledWith(7);
  });

  it('forwards onFailure without touching the store', () => {
    const onFailure = vi.fn();
    replayDeleteMatch(7, onFailure);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespNotConnected, CommandFailure.Timeout);
    expect(WebClient.instance.response.session.replayDeleteMatch).not.toHaveBeenCalled();
  });
});

describe('replayList', () => {
  it('sends Command_ReplayList', () => {
    replayList();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplayList_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ReplayList_ext })
    );
  });

  it('calls replayList on success', () => {
    replayList();
    const resp = { matchList: [] };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.replayList).toHaveBeenCalledWith([]);
  });

  it('reports a failure to replayListFailed', () => {
    replayList();
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.session.replayListFailed).toHaveBeenCalledWith(
      Response_ResponseCode.RespNotConnected, CommandFailure.Timeout,
    );
  });
});

describe('replayModifyMatch', () => {
  it('sends Command_ReplayModifyMatch', () => {
    replayModifyMatch(7, true);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplayModifyMatch_ext, expect.objectContaining({ gameId: 7, doNotHide: true }), expect.any(Object)
    );
  });

  it('calls replayModifyMatch on success', () => {
    replayModifyMatch(7, true);
    invokeOnSuccess();
    expect(WebClient.instance.response.session.replayModifyMatch).toHaveBeenCalledWith(7, true);
  });

  it('forwards onFailure without touching the store', () => {
    const onFailure = vi.fn();
    replayModifyMatch(7, true, onFailure);
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespFunctionNotAllowed, undefined);
    expect(WebClient.instance.response.session.replayModifyMatch).not.toHaveBeenCalled();
  });
});

describe('addToList / addToBuddyList / addToIgnoreList', () => {
  it('addToBuddyList sends Command_AddToList with list=buddy', () => {
    addToBuddyList('alice');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_AddToList_ext,
      expect.objectContaining({ list: 'buddy' }),
      expect.any(Object)
    );
  });

  it('addToIgnoreList sends Command_AddToList with list=ignore', () => {
    addToIgnoreList('bob');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_AddToList_ext,
      expect.objectContaining({ list: 'ignore' }),
      expect.any(Object)
    );
  });

  it('onSuccess calls WebClient.instance.response.session.addToList', () => {
    addToList('buddy', 'alice');
    invokeOnSuccess();
    expect(WebClient.instance.response.session.addToList).toHaveBeenCalledWith('buddy', 'alice');
  });
});

describe('removeFromList / removeFromBuddyList / removeFromIgnoreList', () => {
  it('removeFromBuddyList sends Command_RemoveFromList with list=buddy', () => {
    removeFromBuddyList('alice');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_RemoveFromList_ext,
      expect.objectContaining({ list: 'buddy' }),
      expect.any(Object)
    );
  });

  it('removeFromIgnoreList sends Command_RemoveFromList with list=ignore', () => {
    removeFromIgnoreList('bob');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_RemoveFromList_ext,
      expect.objectContaining({ list: 'ignore' }),
      expect.any(Object)
    );
  });

  it('onSuccess calls WebClient.instance.response.session.removeFromList', () => {
    removeFromList('buddy', 'alice');
    invokeOnSuccess();
    expect(WebClient.instance.response.session.removeFromList).toHaveBeenCalledWith('buddy', 'alice');
  });
});

describe('replayGetCode', () => {
  it('sends Command_ReplayGetCode with gameId and responseExt', () => {
    replayGetCode(42, vi.fn());
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplayGetCode_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_ReplayGetCode_ext })
    );
  });

  it('calls onCodeReceived with replayCode on success', () => {
    const onCodeReceived = vi.fn();
    replayGetCode(42, onCodeReceived);
    invokeOnSuccess({ replayCode: 'abc123-xyz' });
    expect(onCodeReceived).toHaveBeenCalledWith('abc123-xyz');
  });

  it('forwards onFailure with the response code', () => {
    const onCodeReceived = vi.fn();
    const onFailure = vi.fn();
    replayGetCode(42, onCodeReceived, onFailure);
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespFunctionNotAllowed, undefined);
    expect(onCodeReceived).not.toHaveBeenCalled();
  });
});

describe('replaySubmitCode', () => {
  it('sends Command_ReplaySubmitCode with replayCode', () => {
    replaySubmitCode('42-abc123');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplaySubmitCode_ext, expect.objectContaining({ replayCode: '42-abc123' }), expect.any(Object)
    );
  });

  it('forwards onSubmitted callback', () => {
    const onSubmitted = vi.fn();
    replaySubmitCode('42-abc123', onSubmitted);
    invokeOnSuccess();
    expect(onSubmitted).toHaveBeenCalled();
  });

  it('forwards onFailure callback', () => {
    const onFailure = vi.fn();
    replaySubmitCode('42-abc123', undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Disconnected);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespNotConnected, CommandFailure.Disconnected);
  });
});

describe('deckDownload', () => {
  it('sends Command_DeckDownload', () => {
    deckDownload(42);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckDownload_ext,
      expect.objectContaining({ deckId: 42 }),
      expect.objectContaining({ responseExt: Response_DeckDownload_ext })
    );
  });

  it('calls downloadServerDeck on success', () => {
    deckDownload(42);
    const resp = { deck: 'deck-content' };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.downloadServerDeck).toHaveBeenCalledWith(42, resp);
  });

  it('reports a failure to deckDownloadFailed with the deckId', () => {
    deckDownload(42);
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, CommandFailure.Timeout);
    expect(WebClient.instance.response.session.deckDownloadFailed).toHaveBeenCalledWith(
      42, Response_ResponseCode.RespNotConnected, CommandFailure.Timeout,
    );
  });
});

describe('replayDownload', () => {
  it('sends Command_ReplayDownload', () => {
    replayDownload(99);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_ReplayDownload_ext,
      expect.objectContaining({ replayId: 99 }),
      expect.objectContaining({ responseExt: Response_ReplayDownload_ext })
    );
  });

  it('calls replayDownloaded on success', () => {
    replayDownload(99);
    const resp = { replayData: new Uint8Array([1, 2, 3]) };
    invokeOnSuccess(resp, { responseCode: 0 });
    expect(WebClient.instance.response.session.replayDownloaded).toHaveBeenCalledWith(99, resp);
  });

  it('hands the replay bytes to onDownloaded only, keeping them out of the store', () => {
    const onDownloaded = vi.fn();
    replayDownload(99, onDownloaded);
    const replayData = new Uint8Array([1, 2, 3]);
    invokeOnSuccess({ replayData }, { responseCode: 0 });
    expect(onDownloaded).toHaveBeenCalledWith(replayData);
    expect(WebClient.instance.response.session.replayDownloaded).not.toHaveBeenCalled();
  });

  it('forwards onFailure with the response code', () => {
    const onFailure = vi.fn();
    replayDownload(99, undefined, onFailure);
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(onFailure).toHaveBeenCalledWith(Response_ResponseCode.RespNameNotFound, undefined);
  });
});

describe('deprecated account password credentials', () => {
  it('omits an empty caller hash while preserving the plaintext password', () => {
    expect(accountPassword('old', 'new', '')).toBeUndefined();
    const [ext, cmd] = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls[0];
    expect(ext).toBe(Command_AccountPassword_ext);
    expect({ ...cmd }).toEqual({ $typeName: cmd.$typeName, oldPassword: 'old', newPassword: 'new' });
    expect(hashPassword).not.toHaveBeenCalled();
    invokeOnSuccess();
    expect(WebClient.instance.response.session.accountPasswordChange).toHaveBeenCalledExactlyOnceWith();
  });
});

describe('room join settlement boundaries', () => {
  it('keeps a pending user join user-initiated when an autojoin arrives', () => {
    joinRoom(5);
    joinRoom(5, false);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledTimes(1);
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledExactlyOnceWith(
      5, Response_ResponseCode.RespNameNotFound, undefined, true,
    );
  });

  it('settles a successful response without room info so a later join can send', () => {
    joinRoom(5);
    invokeOnSuccess({});
    expect(WebClient.instance.response.room.joinRoom).not.toHaveBeenCalled();
    joinRoom(5);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledTimes(2);
    invokeOnError(Response_ResponseCode.RespNameNotFound);
    expect(WebClient.instance.response.room.joinRoomFailed).toHaveBeenCalledExactlyOnceWith(
      5, Response_ResponseCode.RespNameNotFound, undefined, true,
    );
  });

  it('ignores a healing leave rejection and still accepts the rejoin', () => {
    joinRoom(5);
    invokeResponseCode(Response_ResponseCode.RespContextError);
    const [roomId, extension, value, options] = (WebClient.instance.protobuf.sendRoomCommand as Mock).mock.calls[0];
    expect(roomId).toBe(5);
    expect(extension).toBe(Command_LeaveRoom_ext);
    expect({ ...value }).toEqual({ $typeName: value.$typeName });
    options.onError(Response_ResponseCode.RespContextError);
    expect(WebClient.instance.response.room.joinRoomFailed).not.toHaveBeenCalled();
    const send = WebClient.instance.protobuf.sendSessionCommand as Mock;
    expect(send).toHaveBeenCalledTimes(2);
    const [retryExtension, retryValue, retryOptions] = send.mock.calls[1];
    expect(retryExtension).toBe(Command_JoinRoom_ext);
    expect({ ...retryValue }).toEqual({ $typeName: retryValue.$typeName, roomId: 5 });
    const roomInfo = { roomId: 5 };
    retryOptions.onSuccess({ roomInfo });
    expect(WebClient.instance.response.room.joinRoom).toHaveBeenCalledExactlyOnceWith(roomInfo, true);
  });
});
