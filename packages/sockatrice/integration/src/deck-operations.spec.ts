// Deck operations — extended scenarios beyond deck.spec.ts. Covers error
// paths, nested folder structures, multi-step upload-then-download flows,
// and the interplay between directory and file operations. The basic
// happy-path round-trips (deckList, deckUpload, deckDownload, deckDel,
// deckNewDir, deckDelDir) live in deck.spec.ts; this spec exercises the
// surrounding behavior.

import { create } from '@bufbuild/protobuf';
import { describe, expect, it } from 'vitest';

import * as Data from '../../src/generated';
import { SessionCommands } from '../../src';

import { connectAndLogin, getMockResponse } from '../../src/testing/setup';
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

  it('deckUpload on InternalError does not dispatch uploadServerDeck', () => {
    connectAndLogin();

    SessionCommands.deckUpload('/decks', 0, '4 Llanowar Elves');

    const { cmdId } = findLastSessionCommand(Data.Command_DeckUpload_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespInternalError,
    })));

    expect(getMockResponse().session.uploadServerDeck).not.toHaveBeenCalled();
    expect(consoleError.current).toHaveBeenCalledWith(
      `Command_DeckUpload.ext failed with response code: ${Data.Response_ResponseCode.RespInternalError}`,
    );
  });

  it('deckNewDir on ContextError does not dispatch createServerDeckDir', () => {
    connectAndLogin();

    SessionCommands.deckNewDir('/missing/parent', 'Child');

    const { cmdId } = findLastSessionCommand(Data.Command_DeckNewDir_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespContextError,
    })));

    expect(getMockResponse().session.createServerDeckDir).not.toHaveBeenCalled();
    expect(consoleError.current).toHaveBeenCalledWith(
      `Command_DeckNewDir.ext failed with response code: ${Data.Response_ResponseCode.RespContextError}`,
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
