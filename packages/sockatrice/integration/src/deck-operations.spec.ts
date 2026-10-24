// Deck operations — extended scenarios beyond deck.spec.ts. Covers error
// paths, nested folder structures, multi-step upload-then-download flows,
// and the interplay between directory and file operations. The basic
// happy-path round-trips (deckList, deckUpload, deckDownload, deckDel,
// deckNewDir, deckDelDir) live in deck.spec.ts; this spec exercises the
// surrounding behavior.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it, vi } from 'vitest';

import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';

import { connectAndLogin, getMockResponse, getMockWebSocket, getWebClient } from '../../src/testing/setup';
import { WebsocketTypes } from '../../src/types';
import {
  buildResponse,
  buildResponseMessage,
  deliverMessage,
} from '../../src/testing/protobuf-builders';
import { findLastSessionCommand } from '../../src/testing/command-capture';
import { expectConsoleErrors } from '../../src/testing/console-helpers';

describe('deck operations: error paths', () => {
  const consoleError = expectConsoleErrors();

  it('deckDel on NotFound does not dispatch deleteServerDeck', () => {
    connectAndLogin();

    SessionCommands.deckDel(999);

    const { cmdId } = findLastSessionCommand(Data.Command_DeckDel_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespNameNotFound,
    })));

    expect(getMockResponse().session.deleteServerDeck).not.toHaveBeenCalled();
    expect(consoleError.current).toHaveBeenCalledWith(
      `Command_DeckDel.ext failed with response code: ${Data.Response_ResponseCode.RespNameNotFound}`,
    );
  });

  it('deckUpload on InternalError reports deckUploadFailed instead of uploadServerDeck', () => {
    connectAndLogin();

    SessionCommands.deckUpload('/decks', 0, '4 Llanowar Elves');

    const { cmdId } = findLastSessionCommand(Data.Command_DeckUpload_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespInternalError,
    })));

    expect(getMockResponse().session.uploadServerDeck).not.toHaveBeenCalled();
    expect(getMockResponse().session.deckUploadFailed).toHaveBeenCalledWith(
      '/decks', Data.Response_ResponseCode.RespInternalError, undefined,
    );
  });

  it('deckNewDir on ContextError reports deckNewDirFailed instead of createServerDeckDir', () => {
    connectAndLogin();

    SessionCommands.deckNewDir('/missing/parent', 'Child');

    const { cmdId } = findLastSessionCommand(Data.Command_DeckNewDir_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespContextError,
    })));

    expect(getMockResponse().session.createServerDeckDir).not.toHaveBeenCalled();
    expect(getMockResponse().session.deckNewDirFailed).toHaveBeenCalledWith(
      '/missing/parent', 'Child', Data.Response_ResponseCode.RespContextError, undefined,
    );
  });

  it('deckDelDir on FunctionNotAllowed does not dispatch deleteServerDeckDir', () => {
    connectAndLogin();

    SessionCommands.deckDelDir('/protected');

    const { cmdId } = findLastSessionCommand(Data.Command_DeckDelDir_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
    })));

    expect(getMockResponse().session.deleteServerDeckDir).not.toHaveBeenCalled();
    expect(consoleError.current).toHaveBeenCalledWith(
      `Command_DeckDelDir.ext failed with response code: ${Data.Response_ResponseCode.RespFunctionNotAllowed}`,
    );
  });
});

describe('deck operations: nested folder structures', () => {
  it('deckList with deeply nested folders dispatches the full tree', () => {
    connectAndLogin();

    SessionCommands.deckList();

    const { cmdId } = findLastSessionCommand(Data.Command_DeckList_ext);

    const leafFile = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 11,
      name: 'Nested.cod',
      file: create(Data.ServerInfo_DeckStorage_FileSchema, { creationTime: 2000 }),
    });
    const innerFolder = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 10,
      name: 'Modern',
      folder: create(Data.ServerInfo_DeckStorage_FolderSchema, { items: [leafFile] }),
    });
    const outerFolder = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 5,
      name: 'Decks',
      folder: create(Data.ServerInfo_DeckStorage_FolderSchema, { items: [innerFolder] }),
    });
    const root = create(Data.ServerInfo_DeckStorage_FolderSchema, { items: [outerFolder] });

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckList_ext,
      value: create(Data.Response_DeckListSchema, { root }),
    })));

    expect(getMockResponse().session.updateServerDecks).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              name: 'Decks',
              folder: expect.objectContaining({
                items: expect.arrayContaining([expect.objectContaining({ name: 'Modern' })]),
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it('deckList with empty root does not dispatch updateServerDecks when root is missing', () => {
    connectAndLogin();

    SessionCommands.deckList();

    const { cmdId } = findLastSessionCommand(Data.Command_DeckList_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckList_ext,
      value: create(Data.Response_DeckListSchema),
    })));

    expect(getMockResponse().session.updateServerDecks).not.toHaveBeenCalled();
  });
});

describe('deck operations: multi-step flows', () => {
  it('create folder → upload deck into folder → download → delete deck → delete folder', () => {
    connectAndLogin();

    SessionCommands.deckNewDir('/', 'Standard');
    const newDir = findLastSessionCommand(Data.Command_DeckNewDir_ext);
    expect(newDir.value.path).toBe('/');
    expect(newDir.value.dirName).toBe('Standard');
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: newDir.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));
    expect(getMockResponse().session.createServerDeckDir).toHaveBeenCalledWith('/', 'Standard');

    SessionCommands.deckUpload('/Standard', 0, '4 Thoughtseize\n4 Inquisition of Kozilek');
    const upload = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(upload.value.path).toBe('/Standard');
    expect(upload.value.deckList).toContain('Thoughtseize');

    const newFile = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 42,
      name: 'MonoBlack.cod',
      file: create(Data.ServerInfo_DeckStorage_FileSchema, { creationTime: 3000 }),
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: upload.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckUpload_ext,
      value: create(Data.Response_DeckUploadSchema, { newFile }),
    })));
    expect(getMockResponse().session.uploadServerDeck).toHaveBeenCalledWith(
      '/Standard',
      expect.objectContaining({ id: 42, name: 'MonoBlack.cod' }),
    );

    SessionCommands.deckDownload(42);
    const download = findLastSessionCommand(Data.Command_DeckDownload_ext);
    expect(download.value.deckId).toBe(42);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: download.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckDownload_ext,
      value: create(Data.Response_DeckDownloadSchema, { deck: '4 Thoughtseize\n4 Inquisition of Kozilek' }),
    })));
    expect(getMockResponse().session.downloadServerDeck).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ deck: expect.stringContaining('Thoughtseize') }),
    );

    SessionCommands.deckDel(42);
    const del = findLastSessionCommand(Data.Command_DeckDel_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: del.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));
    expect(getMockResponse().session.deleteServerDeck).toHaveBeenCalledWith(42);

    SessionCommands.deckDelDir('/Standard');
    const delDir = findLastSessionCommand(Data.Command_DeckDelDir_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: delDir.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));
    expect(getMockResponse().session.deleteServerDeckDir).toHaveBeenCalledWith('/Standard');
  });

  it('deckUpload to root path with empty deck list still issues the command', () => {
    connectAndLogin();

    SessionCommands.deckUpload('/', 0, '');
    const { value } = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(value.path).toBe('/');
    expect(value.deckList).toBe('');
  });

  it('deckUpload with non-zero deckId targets an overwrite of an existing file', () => {
    connectAndLogin();

    SessionCommands.deckUpload('/folder', 13, '4 Counterspell');
    const { value, cmdId } = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(value.deckId).toBe(13);

    const newFile = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 13,
      name: 'BlueDeck.cod',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckUpload_ext,
      value: create(Data.Response_DeckUploadSchema, { newFile }),
    })));

    expect(getMockResponse().session.uploadServerDeck).toHaveBeenCalledWith(
      '/folder',
      expect.objectContaining({ id: 13 }),
    );
  });
});

describe('deck operations: update acknowledgements', () => {
  function sendUpdate(onSettled?: Parameters<typeof SessionCommands.deckUpdate>[4]) {
    const socket = getMockWebSocket();
    socket.send.mockClear();
    SessionCommands.deckUpdate(7, '<updated/>', false, '', onSettled);
    const command = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(socket.send.mock.calls).toHaveLength(1);
    expect({ ...command.value }).toEqual({
      $typeName: 'Command_DeckUpload', deckId: 7, deckList: '<updated/>', isPublic: false, colorIdentity: '',
    });
    return command.cmdId;
  }

  function acknowledge(cmdId: number, responseCode: Data.Response_ResponseCode, newFile?: Data.ServerInfo_DeckStorage_TreeItem) {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId, responseCode, ext: Data.Response_DeckUpload_ext,
        value: create(Data.Response_DeckUploadSchema, { newFile }),
      })));
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  }

  it('routes out-of-order saves to their own settlement callbacks after updating server state', () => {
    connectAndLogin();
    const session = getMockResponse().session;
    const first = vi.fn();
    const second = vi.fn();
    const firstId = sendUpdate(first);
    const secondId = sendUpdate(second);

    acknowledge(secondId, Data.Response_ResponseCode.RespOk,
      create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Saved', file: { creationTime: 20 } }));
    expect(vi.mocked(session.updateServerDeck!).mock.calls).toEqual([
      [7, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Saved', file: { creationTime: 20, colorIdentity: '' } })],
    ]);
    expect(second.mock.calls).toEqual([[null]]);
    expect(first.mock.calls).toEqual([]);
    expect(vi.mocked(session.updateServerDeck!).mock.invocationCallOrder[0]).toBeLessThan(second.mock.invocationCallOrder[0]);

    acknowledge(firstId, Data.Response_ResponseCode.RespContextError);
    expect(vi.mocked(session.updateServerDeckFailed!).mock.calls).toEqual([
      [7, Data.Response_ResponseCode.RespContextError, undefined],
    ]);
    expect(first.mock.calls).toEqual([[{ responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined }]]);
    expect(second.mock.calls).toEqual([[null]]);
    expect(vi.mocked(session.updateServerDeck!).mock.calls).toEqual([
      [7, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Saved', file: { creationTime: 20, colorIdentity: '' } })],
    ]);
    expect(vi.mocked(session.updateServerDeckFailed!).mock.invocationCallOrder[0]).toBeLessThan(first.mock.invocationCallOrder[0]);
    expect(vi.mocked(session.uploadServerDeck).mock.calls).toEqual([]);
  });

  it('routes success without a file and failure when no settlement callback was supplied', () => {
    connectAndLogin();
    const session = getMockResponse().session;
    const socket = getMockWebSocket();
    socket.send.mockClear();
    SessionCommands.deckUpdate(7, '<updated/>');
    const command = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(socket.send.mock.calls).toHaveLength(1);
    expect({ ...command.value }).toEqual({ $typeName: 'Command_DeckUpload', deckId: 7, deckList: '<updated/>' });

    acknowledge(command.cmdId, Data.Response_ResponseCode.RespOk);
    expect(vi.mocked(session.updateServerDeck!).mock.calls).toEqual([[7, undefined]]);
    expect(vi.mocked(session.updateServerDeckFailed!).mock.calls).toEqual([]);

    acknowledge(sendUpdate(), Data.Response_ResponseCode.RespContextError);
    expect(vi.mocked(session.updateServerDeck!).mock.calls).toEqual([[7, undefined]]);
    expect(vi.mocked(session.updateServerDeckFailed!).mock.calls).toEqual([
      [7, Data.Response_ResponseCode.RespContextError, undefined],
    ]);
  });

  it('settles success and failure when the response implementation omits optional update handlers', () => {
    connectAndLogin();
    const client = getWebClient();
    const original = client.response.session;
    const first = vi.fn();
    const second = vi.fn();
    client.response.session = Object.assign(Object.create(original), {
      updateServerDeck: undefined, updateServerDeckFailed: undefined,
    });
    try {
      acknowledge(sendUpdate(first), Data.Response_ResponseCode.RespOk);
      acknowledge(sendUpdate(second), Data.Response_ResponseCode.RespContextError);
      expect(first.mock.calls).toEqual([[null]]);
      expect(second.mock.calls).toEqual([[{ responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined }]]);
      expect(vi.mocked(original.updateServerDeck!).mock.calls).toEqual([]);
      expect(vi.mocked(original.updateServerDeckFailed!).mock.calls).toEqual([]);
    } finally {
      client.response.session = original;
    }
  });

  it('forwards a transport failure to the response handler and the originating save', () => {
    connectAndLogin();
    const session = getMockResponse().session;
    const settled = vi.fn();
    sendUpdate(settled);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getMockWebSocket().close();
      expect(vi.mocked(session.updateServerDeckFailed!).mock.calls).toEqual([
        [7, Data.Response_ResponseCode.RespNotConnected, WebsocketTypes.CommandFailure.Disconnected],
      ]);
      expect(settled.mock.calls).toEqual([[
        { responseCode: Data.Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected },
      ]]);
      expect(vi.mocked(session.updateServerDeck!).mock.calls).toEqual([]);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('deck upload response identity', () => {
  it.each([[] as [string?], ['import-a'] as [string?]])(
    'keeps request identity client-side and tolerates an acknowledgement without a file (%s)', (...correlation) => {
      connectAndLogin();
      getMockWebSocket().send.mockClear();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        SessionCommands.deckUpload('/imports', 0, '<deck/>', undefined, undefined, ...correlation);
        const empty = findLastSessionCommand(Data.Command_DeckUpload_ext);
        expect({ ...empty.value }).toEqual({
          $typeName: 'Command_DeckUpload', path: '/imports', deckId: 0, deckList: '<deck/>',
        });
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId: empty.cmdId, responseCode: Data.Response_ResponseCode.RespOk,
          ext: Data.Response_DeckUpload_ext, value: create(Data.Response_DeckUploadSchema),
        })));
        expect(vi.mocked(getMockResponse().session.uploadServerDeck).mock.calls).toEqual([]);
        expect(vi.mocked(getMockResponse().session.deckUploadFailed!).mock.calls).toEqual([]);

        SessionCommands.deckUpload('/imports', 0, '<deck/>', true, 'WU', ...correlation);
        const uploaded = findLastSessionCommand(Data.Command_DeckUpload_ext);
        expect({ ...uploaded.value }).toEqual({
          $typeName: 'Command_DeckUpload', path: '/imports', deckId: 0, deckList: '<deck/>', isPublic: true, colorIdentity: 'WU',
        });
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId: uploaded.cmdId, responseCode: Data.Response_ResponseCode.RespOk,
          ext: Data.Response_DeckUpload_ext,
          value: create(Data.Response_DeckUploadSchema, { newFile: { id: 42, name: 'Server-assigned' } }),
        })));
        expect(vi.mocked(getMockResponse().session.uploadServerDeck).mock.calls).toEqual([
          ['/imports', create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 42, name: 'Server-assigned' }), ...correlation],
        ]);

        SessionCommands.deckUpload('/imports', 0, '<deck/>', undefined, undefined, ...correlation);
        const failed = findLastSessionCommand(Data.Command_DeckUpload_ext);
        expect({ ...failed.value }).toEqual({
          $typeName: 'Command_DeckUpload', path: '/imports', deckId: 0, deckList: '<deck/>',
        });
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId: failed.cmdId, responseCode: Data.Response_ResponseCode.RespFunctionNotAllowed,
        })));
        expect(vi.mocked(getMockResponse().session.deckUploadFailed!).mock.calls).toEqual([
          ['/imports', Data.Response_ResponseCode.RespFunctionNotAllowed, undefined, ...correlation],
        ]);
        expect(vi.mocked(getMockResponse().session.uploadServerDeck).mock.calls).toEqual([
          ['/imports', create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 42, name: 'Server-assigned' }), ...correlation],
        ]);
        expect(getMockWebSocket().send.mock.calls).toHaveLength(3);
        expect(errors.mock.calls).toEqual([]);
      } finally {
        errors.mockRestore();
      }
    },
  );
});
