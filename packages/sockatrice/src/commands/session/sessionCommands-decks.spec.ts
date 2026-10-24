
vi.mock('../../WebClient');

import { create, isFieldSet } from '@bufbuild/protobuf';
import { Mock } from 'vitest';
import { makeCallbackHelpers } from '../../testing/callback-helpers';
import { WebClient } from '../../WebClient';
import { CommandFailure } from '../../types/CommandFailure';
import {
  Command_DeckDownloadPublic_ext,
  Command_DeckListOtherUser_ext,
  Command_DeckSetVisibility_ext,
  Command_DeckShareCreate_ext,
  DeckShareItemSchema,
  Command_DeckShareDownload_ext,
  Command_DeckShareList_ext,
  Command_DeckShareListMine_ext,
  Command_DeckShareRemove_ext,
  Command_DeckUpload_ext,
  Command_DeckUploadSchema,
  Response_DeckDownload_ext,
  Response_DeckList_ext,
  Response_DeckShareCreate_ext,
  Response_DeckShareDownload_ext,
  Response_DeckShareList_ext,
  Response_DeckShareListMine_ext,
  Response_ResponseCode,
  ServerInfo_DeckShareSummarySchema,
} from '../../generated';

import { deckDownloadPublic } from './deckDownloadPublic';
import { deckListOtherUser } from './deckListOtherUser';
import { deckSetVisibility } from './deckSetVisibility';
import { deckShareCreate } from './deckShareCreate';
import { deckShareDownload } from './deckShareDownload';
import { deckShareList } from './deckShareList';
import { deckShareListMine } from './deckShareListMine';
import { deckShareRemove } from './deckShareRemove';
import { deckUpload } from './deckUpload';

const { invokeOnSuccess, invokeOnError } = makeCallbackHelpers(
  WebClient.instance.protobuf.sendSessionCommand as Mock,
  2
);

describe('deckShareCreate', () => {
  it('sends Command_DeckShareCreate with items expecting Response_DeckShareCreate', () => {
    deckShareCreate({ name: 'Cube', items: [{ deckId: 4, colorIdentity: 'UR' }] });
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareCreate_ext,
      expect.objectContaining({ name: 'Cube', items: [expect.objectContaining({ deckId: 4, colorIdentity: 'UR' })] }),
      expect.objectContaining({ responseExt: Response_DeckShareCreate_ext })
    );
  });

  it('sends a folder share without items', () => {
    deckShareCreate({ name: 'Cube', folderPath: 'cubes' });
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareCreate_ext,
      expect.objectContaining({ folderPath: 'cubes', items: [] }),
      expect.any(Object)
    );
  });

  it('forwards the share token to response.session.deckShareCreated', () => {
    deckShareCreate({ name: 'Cube', folderPath: 'cubes' });
    const resp = { token: 'tok', expiresAt: 10n, itemCount: 2 };
    invokeOnSuccess(resp);
    expect(WebClient.instance.response.session.deckShareCreated).toHaveBeenCalledWith(resp);
  });

  it('does not reach the response contract on RespTooManyRequests', () => {
    deckShareCreate({ name: 'Cube', folderPath: 'cubes' });
    invokeOnError(Response_ResponseCode.RespTooManyRequests);
    expect(WebClient.instance.response.session.deckShareCreated).not.toHaveBeenCalled();
  });
});

describe('deckShareList', () => {
  it('sends Command_DeckShareList with the token', () => {
    deckShareList('tok');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareList_ext,
      expect.objectContaining({ token: 'tok' }),
      expect.objectContaining({ responseExt: Response_DeckShareList_ext })
    );
  });

  it('forwards the bundle keyed by token', () => {
    deckShareList('tok');
    const resp = { name: 'Cube', items: [] };
    invokeOnSuccess(resp);
    expect(WebClient.instance.response.session.deckShareListed).toHaveBeenCalledWith('tok', resp);
  });
});

describe('deckShareDownload', () => {
  it('sends Command_DeckShareDownload with token and itemId', () => {
    deckShareDownload('tok', 9);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareDownload_ext,
      expect.objectContaining({ token: 'tok', itemId: 9 }),
      expect.objectContaining({ responseExt: Response_DeckShareDownload_ext })
    );
  });

  it('forwards the deck text', () => {
    deckShareDownload('tok', 9);
    invokeOnSuccess({ deck: '<deck/>' });
    expect(WebClient.instance.response.session.deckShareDownloaded).toHaveBeenCalledWith('tok', 9, '<deck/>');
  });
});

describe('deckShareListMine', () => {
  it('sends Command_DeckShareListMine and forwards the share summaries', () => {
    deckShareListMine();
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareListMine_ext,
      expect.any(Object),
      expect.objectContaining({ responseExt: Response_DeckShareListMine_ext })
    );
    const shares = [create(ServerInfo_DeckShareSummarySchema, { id: 1, name: 'Cube', itemCount: 2 })];
    invokeOnSuccess({ shares });
    expect(WebClient.instance.response.session.deckSharesMine).toHaveBeenCalledWith(shares);
  });
});

describe('deckShareRemove', () => {
  it('sends Command_DeckShareRemove and reports the removed share', () => {
    deckShareRemove(5);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckShareRemove_ext,
      expect.objectContaining({ shareId: 5 }),
      expect.any(Object)
    );
    invokeOnSuccess();
    expect(WebClient.instance.response.session.deckShareRemoved).toHaveBeenCalledWith(5);
  });
});

describe('deckListOtherUser', () => {
  it('sends Command_DeckListOtherUser expecting a Response_DeckList', () => {
    deckListOtherUser('bob');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckListOtherUser_ext,
      expect.objectContaining({ userName: 'bob' }),
      expect.objectContaining({ responseExt: Response_DeckList_ext })
    );
  });

  it('forwards the public deck tree keyed by user', () => {
    deckListOtherUser('bob');
    const resp = { root: { items: [] } };
    invokeOnSuccess(resp);
    expect(WebClient.instance.response.session.otherUserDecks).toHaveBeenCalledWith('bob', resp);
  });
});

describe('deckSetVisibility', () => {
  it('sends Command_DeckSetVisibility for a single deck and echoes the params on success', () => {
    const params = { deckId: 4, isPublic: true };
    deckSetVisibility(params);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckSetVisibility_ext,
      expect.objectContaining(params),
      expect.any(Object)
    );
    invokeOnSuccess();
    expect(WebClient.instance.response.session.deckVisibilityChanged).toHaveBeenCalledWith(params);
  });
});

describe('deckDownloadPublic', () => {
  it('sends Command_DeckDownloadPublic and forwards the deck text', () => {
    deckDownloadPublic(4);
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckDownloadPublic_ext,
      expect.objectContaining({ deckId: 4 }),
      expect.objectContaining({ responseExt: Response_DeckDownload_ext })
    );
    invokeOnSuccess({ deck: '<deck/>' });
    expect(WebClient.instance.response.session.publicDeckDownloaded).toHaveBeenCalledWith(4, '<deck/>');
  });
});

describe('deckUpload (3.1 fields)', () => {
  it('sends isPublic and colorIdentity when supplied', () => {
    deckUpload('/decks', 0, '<deck/>', true, 'WU');
    expect(WebClient.instance.protobuf.sendSessionCommand).toHaveBeenCalledWith(
      Command_DeckUpload_ext,
      expect.objectContaining({ path: '/decks', deckList: '<deck/>', isPublic: true, colorIdentity: 'WU' }),
      expect.any(Object)
    );
  });

  it('leaves the 3.1 fields unset when omitted', () => {
    deckUpload('/decks', 0, '<deck/>');
    const sent = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls.at(-1)![1];
    expect(isFieldSet(sent, Command_DeckUploadSchema.field.isPublic)).toBe(false);
    expect(isFieldSet(sent, Command_DeckUploadSchema.field.colorIdentity)).toBe(false);
  });
});

describe.each(Object.values(CommandFailure))('deck sharing transport failures: %s', (failure) => {
  it.each([
    ['deckShareCreate', () => deckShareCreate({ folderPath: 'Cube' }), 'Cube'],
    ['deckShareList', () => deckShareList('tok'), 'tok'],
    ['deckShareDownload', () => deckShareDownload('tok', 9), 'tok'],
    ['deckShareListMine', () => deckShareListMine(), ''],
    ['deckShareRemove', () => deckShareRemove(5), '5'],
    ['deckListOtherUser', () => deckListOtherUser('bob'), 'bob'],
    ['deckSetVisibility', () => deckSetVisibility({ deckId: 4, isPublic: true }), '4'],
    ['deckDownloadPublic', () => deckDownloadPublic(4), '4'],
  ] as const)('forwards the command, target and reason for %s', (command, send, target) => {
    send();
    invokeOnError(Response_ResponseCode.RespNotConnected, {}, failure);
    expect(WebClient.instance.response.session.commandFailed).toHaveBeenCalledWith(
      command, Response_ResponseCode.RespNotConnected, target, failure,
    );
  });
});

describe('deck sharing outcome boundaries', () => {
  it('reports an item share failure with an empty target and no request identity', () => {
    deckShareCreate({ name: 'Cube', items: [{ deckId: 4 }] });
    const calls = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(Command_DeckShareCreate_ext);
    expect({ ...calls[0][1] }).toEqual({
      $typeName: 'Command_DeckShareCreate', name: 'Cube',
      items: [create(DeckShareItemSchema, { deckId: 4 })],
    });
    invokeOnError(Response_ResponseCode.RespFunctionNotAllowed);
    expect(vi.mocked(WebClient.instance.response.session.commandFailed!).mock.calls).toEqual([
      ['deckShareCreate', Response_ResponseCode.RespFunctionNotAllowed, '', undefined],
    ]);
    expect(vi.mocked(WebClient.instance.response.session.deckShareCreated!).mock.calls).toEqual([]);
  });

  it('does not invent an uploaded file when a successful response omits newFile', () => {
    deckUpload('/imports', 0, '<deck/>', undefined, undefined, 'import-a');
    const calls = (WebClient.instance.protobuf.sendSessionCommand as Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(Command_DeckUpload_ext);
    expect({ ...calls[0][1] }).toEqual({
      $typeName: 'Command_DeckUpload', path: '/imports', deckId: 0, deckList: '<deck/>',
    });
    invokeOnSuccess({});
    expect(vi.mocked(WebClient.instance.response.session.uploadServerDeck).mock.calls).toEqual([]);
    expect(vi.mocked(WebClient.instance.response.session.deckUploadFailed!).mock.calls).toEqual([]);
  });
});
