import '@cockatrice/sockatrice/testing/setup-hooks';
import { create } from '@bufbuild/protobuf';
import { SessionCommands } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import { WebsocketTypes } from '@cockatrice/sockatrice/types';
import {
  buildResponse, buildResponseMessage, connectAndLogin, deliverMessage,
  findLastSessionCommand, getMockWebSocket, getWebClient,
} from '@cockatrice/sockatrice/testing';
import { attachResponseHandlers, createStore } from '../../src';

function originalDecks() {
  return create(Data.Response_DeckListSchema, {
    root: { items: [{
      id: 1, name: 'Modern', folder: { items: [
        { id: 7, name: 'Before', file: {
          creationTime: 10, isPublic: true, colorIdentity: 'WU',
          bannerCardName: 'Island', bannerCardProvider: 'art', tags: ['control'],
        } },
        { id: 8, name: 'Sibling', file: { creationTime: 5 } },
      ] },
    }] },
  });
}

function setup(deckList: Data.Response_DeckList | null = originalDecks()) {
  connectAndLogin();
  const store = createStore();
  const response = attachResponseHandlers(store);
  getWebClient().response = response;
  if (deckList) {
    response.session.updateServerDecks(deckList);
  }
  return store;
}

function sendUpdate(deckId = 7, colorIdentity?: string) {
  const socket = getMockWebSocket();
  socket.send.mockClear();
  const settled = vi.fn();
  SessionCommands.deckUpdate(deckId, '<updated/>', undefined, colorIdentity, settled);
  const command = findLastSessionCommand(Data.Command_DeckUpload_ext);
  expect(socket.send.mock.calls).toHaveLength(1);
  expect({ ...command.value }).toEqual({
    $typeName: 'Command_DeckUpload', deckId, deckList: '<updated/>', ...(colorIdentity === undefined ? {} : { colorIdentity }),
  });
  return { cmdId: command.cmdId, settled };
}

function acknowledge(cmdId: number, newFile?: Data.ServerInfo_DeckStorage_TreeItem) {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    deliverMessage(buildResponseMessage(buildResponse({
      cmdId, responseCode: Data.Response_ResponseCode.RespOk, ext: Data.Response_DeckUpload_ext,
      value: create(Data.Response_DeckUploadSchema, { newFile }),
    })));
    expect(consoleError.mock.calls).toEqual([]);
  } finally {
    consoleError.mockRestore();
  }
}

describe('deck update responses through the socket and store', () => {
  it('merges sparse metadata in a nested folder, preserves siblings, and keeps the prior tree immutable', () => {
    const store = setup();
    const before = store.getState().server.backendDecks;
    expect(before).toEqual(originalDecks());
    const { cmdId, settled } = sendUpdate(7, 'WU');
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 7, name: 'After', file: { creationTime: 20, isPublic: false },
    }));

    expect(store.getState().server.backendDecks).toEqual(create(Data.Response_DeckListSchema, {
      root: { items: [{
        id: 1, name: 'Modern', folder: { items: [
          { id: 7, name: 'After', file: {
            creationTime: 20, isPublic: false, colorIdentity: 'WU',
            bannerCardName: 'Island', bannerCardProvider: 'art', tags: ['control'],
          } },
          { id: 8, name: 'Sibling', file: { creationTime: 5 } },
        ] },
      }] },
    }));
    expect(before).toEqual(originalDecks());
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it('applies explicit empty metadata and false visibility without resetting omitted fields', () => {
    const store = setup();
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    const { cmdId, settled } = sendUpdate();
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 7, file: { isPublic: false, colorIdentity: '', bannerCardName: '', bannerCardProvider: '' },
    }));

    expect(store.getState().server.backendDecks).toEqual(create(Data.Response_DeckListSchema, {
      root: { items: [{
        id: 1, name: 'Modern', folder: { items: [
          { id: 7, name: 'Before', file: {
            creationTime: 10, isPublic: false, colorIdentity: '',
            bannerCardName: '', bannerCardProvider: '', tags: ['control'],
          } },
          { id: 8, name: 'Sibling', file: { creationTime: 5 } },
        ] },
      }] },
    }));
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it('preserves existing file metadata when the acknowledgement only renames the deck', () => {
    const store = setup();
    const { cmdId, settled } = sendUpdate();
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Renamed' }));

    expect(store.getState().server.backendDecks).toEqual(create(Data.Response_DeckListSchema, {
      root: { items: [{
        id: 1, name: 'Modern', folder: { items: [
          { id: 7, name: 'Renamed', file: {
            creationTime: 10, isPublic: true, colorIdentity: 'WU',
            bannerCardName: 'Island', bannerCardProvider: 'art', tags: ['control'],
          } },
          { id: 8, name: 'Sibling', file: { creationTime: 5 } },
        ] },
      }] },
    }));
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it('adds file metadata to an existing item that did not have a file message', () => {
    const store = setup(create(Data.Response_DeckListSchema, { root: { items: [{ id: 7, name: 'Before' }] } }));
    const { cmdId, settled } = sendUpdate();
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, file: { creationTime: 20 } }));

    expect(store.getState().server.backendDecks).toEqual(create(Data.Response_DeckListSchema, {
      root: { items: [{ id: 7, name: 'Before', file: { creationTime: 20, colorIdentity: '' } }] },
    }));
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it('acknowledges a save without a returned tree item and retains the populated tree', () => {
    const store = setup();
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    const dispatch = vi.spyOn(store, 'dispatch');
    try {
      const { cmdId, settled } = sendUpdate();
      acknowledge(cmdId);
      expect(dispatch.mock.calls).toEqual([[
        { type: 'server/deckUpdated', payload: { deckId: 7, treeItem: undefined } },
      ]]);
      expect(store.getState().server.backendDecks).toEqual(originalDecks());
      expect(settled.mock.calls).toEqual([[null]]);
    } finally {
      dispatch.mockRestore();
    }
  });

  it('does not insert an unknown deck into the stored tree', () => {
    const store = setup();
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    const { cmdId, settled } = sendUpdate(99);
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 99, name: 'Unknown', file: { creationTime: 20 } }));
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it.each([
    { name: 'no deck list', deckList: null },
    { name: 'a deck list without a root', deckList: create(Data.Response_DeckListSchema) },
  ])('acknowledges an update with $name without creating a tree', ({ deckList }) => {
    const store = setup(deckList);
    expect(store.getState().server.backendDecks).toEqual(deckList);
    const { cmdId, settled } = sendUpdate();
    acknowledge(cmdId, create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Saved', file: { creationTime: 20 } }));
    expect(store.getState().server.backendDecks).toEqual(deckList);
    expect(settled.mock.calls).toEqual([[null]]);
  });

  it('dispatches the server rejection with the deck id and preserves stored metadata', () => {
    const store = setup();
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    const dispatch = vi.spyOn(store, 'dispatch');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { cmdId, settled } = sendUpdate();
      deliverMessage(buildResponseMessage(buildResponse({ cmdId, responseCode: Data.Response_ResponseCode.RespContextError })));
      expect(dispatch.mock.calls).toEqual([[
        { type: 'server/deckUpdateFailed', payload: {
          deckId: 7, responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined,
        } },
      ]]);
      expect(settled.mock.calls).toEqual([[{ responseCode: Data.Response_ResponseCode.RespContextError, failure: undefined }]]);
      expect(store.getState().server.backendDecks).toEqual(originalDecks());
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
      dispatch.mockRestore();
    }
  });

  it('dispatches a transport failure with its reason and settles the save without changing stored metadata', () => {
    const store = setup();
    expect(store.getState().server.backendDecks).toEqual(originalDecks());
    const { cmdId, settled } = sendUpdate();
    const dispatch = vi.spyOn(store, 'dispatch');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getWebClient().protobuf.resetCommands();
      expect(dispatch.mock.calls).toEqual([
        [{ type: 'server/latencyStatsUpdated', payload: {
          samplesMs: [], stats: { lastMs: 0, maxMs: 0, medianMs: 0, p95Ms: 0, sampleCount: 0 },
        } }],
        [{ type: 'server/deckUpdateFailed', payload: {
          deckId: 7, responseCode: Data.Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected,
        } }],
      ]);
      expect(settled.mock.calls).toEqual([[
        { responseCode: Data.Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected },
      ]]);
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId, responseCode: Data.Response_ResponseCode.RespOk, ext: Data.Response_DeckUpload_ext,
        value: create(Data.Response_DeckUploadSchema, { newFile: { id: 7, name: 'Late save' } }),
      })));
      expect(dispatch.mock.calls).toEqual([
        [{ type: 'server/latencyStatsUpdated', payload: {
          samplesMs: [], stats: { lastMs: 0, maxMs: 0, medianMs: 0, p95Ms: 0, sampleCount: 0 },
        } }],
        [{ type: 'server/deckUpdateFailed', payload: {
          deckId: 7, responseCode: Data.Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected,
        } }],
      ]);
      expect(settled.mock.calls).toEqual([[
        { responseCode: Data.Response_ResponseCode.RespNotConnected, failure: WebsocketTypes.CommandFailure.Disconnected },
      ]]);
      expect(store.getState().server.backendDecks).toEqual(originalDecks());
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
      dispatch.mockRestore();
    }
  });
});
