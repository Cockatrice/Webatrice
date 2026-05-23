// Deck and replay command round-trips — validates the session command pipeline
// for deck CRUD and replay operations end-to-end.

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

describe('deck operations', () => {
  it('dispatches updateServerDecks from deckList response', () => {
    connectAndLogin();

    SessionCommands.deckList();

    const { cmdId } = findLastSessionCommand(Data.Command_DeckList_ext);

    const deckFile = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 1,
      name: 'MyDeck.cod',
      file: create(Data.ServerInfo_DeckStorage_FileSchema, { creationTime: 1000 }),
    });
    const root = create(Data.ServerInfo_DeckStorage_FolderSchema, {
      items: [deckFile],
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckList_ext,
      value: create(Data.Response_DeckListSchema, { root }),
    })));

    expect(getMockResponse().session.updateServerDecks).toHaveBeenCalledWith(
      expect.objectContaining({
        root: expect.objectContaining({
          items: expect.arrayContaining([expect.objectContaining({ name: 'MyDeck.cod' })]),
        }),
      }),
    );
  });

  it('dispatches downloadServerDeck from deckDownload response', () => {
    connectAndLogin();

    SessionCommands.deckDownload(42);

    const { cmdId } = findLastSessionCommand(Data.Command_DeckDownload_ext);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckDownload_ext,
      value: create(Data.Response_DeckDownloadSchema, { deck: '4 Lightning Bolt\n20 Mountain' }),
    })));

    expect(getMockResponse().session.downloadServerDeck).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ deck: expect.stringContaining('Lightning Bolt') }),
    );
  });

  it('deckUpload sends payload and dispatches uploadServerDeck on success', () => {
    connectAndLogin();

    SessionCommands.deckUpload('/folder', 0, '4 Counterspell\n20 Island');

    const { cmdId, value } = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect(value.path).toBe('/folder');
    expect(value.deckList).toContain('Counterspell');

    const newFile = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 7,
      name: 'CounterDeck.cod',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_DeckUpload_ext,
      value: create(Data.Response_DeckUploadSchema, { newFile }),
    })));

    expect(getMockResponse().session.uploadServerDeck).toHaveBeenCalledWith(
      '/folder',
      expect.objectContaining({ name: 'CounterDeck.cod' }),
    );
  });

  it('deckDel sends deckId and dispatches on RespOk', () => {
    connectAndLogin();

    SessionCommands.deckDel(13);

    const { cmdId, value } = findLastSessionCommand(Data.Command_DeckDel_ext);
    expect(value.deckId).toBe(13);

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.deleteServerDeck).toHaveBeenCalledWith(13);
  });

  it('deckNewDir sends path + dirName payload and dispatches on RespOk', () => {
    connectAndLogin();

    SessionCommands.deckNewDir('/parent', 'NewFolder');

    const { cmdId, value } = findLastSessionCommand(Data.Command_DeckNewDir_ext);
    expect(value.path).toBe('/parent');
    expect(value.dirName).toBe('NewFolder');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.createServerDeckDir).toHaveBeenCalledWith('/parent', 'NewFolder');
  });

  it('deckDelDir sends path payload and dispatches on RespOk', () => {
    connectAndLogin();

    SessionCommands.deckDelDir('/folder/to/remove');

    const { cmdId, value } = findLastSessionCommand(Data.Command_DeckDelDir_ext);
    expect(value.path).toBe('/folder/to/remove');

    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.deleteServerDeckDir).toHaveBeenCalledWith('/folder/to/remove');
  });
});

describe('replay operations', () => {
  it('dispatches replayList from replayList response', () => {
    connectAndLogin();

    SessionCommands.replayList();

    const { cmdId } = findLastSessionCommand(Data.Command_ReplayList_ext);

    const match = create(Data.ServerInfo_ReplayMatchSchema, {
      gameId: 99,
      gameName: 'Casual Game',
    });
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
      ext: Data.Response_ReplayList_ext,
      value: create(Data.Response_ReplayListSchema, { matchList: [match] }),
    })));

    expect(getMockResponse().session.replayList).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ gameId: 99, gameName: 'Casual Game' })]),
    );
  });

  it('dispatches replayDeleteMatch on replayDeleteMatch round-trip', () => {
    connectAndLogin();

    SessionCommands.replayDeleteMatch(99);
    const del = findLastSessionCommand(Data.Command_ReplayDeleteMatch_ext);
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId: del.cmdId,
      responseCode: Data.Response_ResponseCode.RespOk,
    })));

    expect(getMockResponse().session.replayDeleteMatch).toHaveBeenCalledWith(99);
  });
});
