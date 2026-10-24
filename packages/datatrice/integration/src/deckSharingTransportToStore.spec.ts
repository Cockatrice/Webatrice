import { create } from '@bufbuild/protobuf';
import type { GenExtension } from '@bufbuild/protobuf/codegenv2';
import { WebClient } from '@cockatrice/sockatrice';
import * as Data from '@cockatrice/sockatrice/generated';
import {
  buildResponse,
  buildResponseMessage,
  captureAllOutbound,
  CLIENT_CONFIG,
  CLIENT_OPTIONS,
  deliverMessage,
  findLastSessionCommand,
  installMockWebSocket,
  openMockWebSocket,
} from '@cockatrice/sockatrice/testing';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { attachResponseHandlers, createStore, server } from '../../src';

const originalWebSocket = globalThis.WebSocket;
installMockWebSocket();

function setup() {
  const store = createStore();
  const client = new WebClient(attachResponseHandlers(store), CLIENT_CONFIG, CLIENT_OPTIONS);
  client.connect({ host: 'localhost', port: '4748' });
  openMockWebSocket();
  return { client, store };
}

function answer<V>(
  command: { cmdId: number },
  ext?: GenExtension<Data.Response, V>,
  value?: V,
): void {
  deliverMessage(buildResponseMessage(buildResponse({
    cmdId: command.cmdId,
    responseCode: Data.Response_ResponseCode.RespOk,
    ext,
    value,
  })));
}

afterEach(() => {
  WebClient.dispose();
  vi.clearAllMocks();
});

afterAll(() => {
  globalThis.WebSocket = originalWebSocket;
});

describe('deck sharing transport to Datatrice', () => {
  it('stores the share list and removes the acknowledged share', () => {
    const { client, store } = setup();
    const shares = [
      create(Data.ServerInfo_DeckShareSummarySchema, { id: 4, name: 'Cube', itemCount: 2 }),
      create(Data.ServerInfo_DeckShareSummarySchema, { id: 7, name: 'Burn', itemCount: 1 }),
    ];

    client.request.session.deckShareListMine();
    const mine = findLastSessionCommand(Data.Command_DeckShareListMine_ext);
    expect(captureAllOutbound()).toHaveLength(1);
    expect({ ...mine.value }).toEqual({ $typeName: 'Command_DeckShareListMine' });
    answer(
      mine,
      Data.Response_DeckShareListMine_ext,
      create(Data.Response_DeckShareListMineSchema, { shares }),
    );
    expect(server.Selectors.getDeckSharesMine(store.getState())!.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 4, name: 'Cube' },
      { id: 7, name: 'Burn' },
    ]);

    client.request.session.deckShareRemove(4);
    const removed = findLastSessionCommand(Data.Command_DeckShareRemove_ext);
    expect(captureAllOutbound()).toHaveLength(2);
    expect({ ...removed.value }).toEqual({ $typeName: 'Command_DeckShareRemove', shareId: 4 });
    answer(removed);
    expect(server.Selectors.getDeckSharesMine(store.getState())!.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 7, name: 'Burn' },
    ]);
  });

  it('dispatches exact share create, list and download signals from correlated responses', () => {
    const { client, store } = setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const dispatch = vi.spyOn(store, 'dispatch');

    try {
      client.request.session.deckShareCreate({ name: 'Cube', folderPath: 'cubes' }, 'create-1');
      const createCommand = findLastSessionCommand(Data.Command_DeckShareCreate_ext);
      expect(captureAllOutbound()).toHaveLength(1);
      expect({ ...createCommand.value }).toEqual({
        $typeName: 'Command_DeckShareCreate',
        name: 'Cube',
        folderPath: 'cubes',
        items: [],
      });
      const created = create(Data.Response_DeckShareCreateSchema, { token: 'secret', expiresAt: 100n, itemCount: 2 });
      answer(createCommand, Data.Response_DeckShareCreate_ext, created);

      client.request.session.deckShareList('secret');
      const listCommand = findLastSessionCommand(Data.Command_DeckShareList_ext);
      expect(captureAllOutbound()).toHaveLength(2);
      expect({ ...listCommand.value }).toEqual({ $typeName: 'Command_DeckShareList', token: 'secret' });
      const listed = create(Data.Response_DeckShareListSchema, { name: 'Cube' });
      answer(listCommand, Data.Response_DeckShareList_ext, listed);

      client.request.session.deckShareDownload('secret', 9);
      const downloadCommand = findLastSessionCommand(Data.Command_DeckShareDownload_ext);
      expect(captureAllOutbound()).toHaveLength(3);
      expect({ ...downloadCommand.value }).toEqual({
        $typeName: 'Command_DeckShareDownload',
        token: 'secret',
        itemId: 9,
      });
      answer(
        downloadCommand,
        Data.Response_DeckShareDownload_ext,
        create(Data.Response_DeckShareDownloadSchema, { deck: '<private-deck/>' }),
      );

      const zeroStats = { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 1 };
      expect(dispatch.mock.calls).toEqual([
        [server.Actions.latencyStatsUpdated({ stats: zeroStats, samplesMs: [0] })],
        [server.Actions.deckShareCreated({ share: created, requestId: 'create-1' })],
        [server.Actions.deckShareListed({ token: 'secret', share: listed })],
        [server.Actions.deckShareDownloaded({ token: 'secret', itemId: 9, deck: '<private-deck/>' })],
      ]);
    } finally {
      dispatch.mockRestore();
      now.mockRestore();
    }
  });

  it('stores another user\'s public tree and dispatches its downloaded deck', () => {
    const { client, store } = setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const dispatch = vi.spyOn(store, 'dispatch');
    const publicDecks = create(Data.Response_DeckListSchema, {
      root: create(Data.ServerInfo_DeckStorage_FolderSchema, {
        items: [create(Data.ServerInfo_DeckStorage_TreeItemSchema, { id: 12, name: 'Public Burn' })],
      }),
    });

    try {
      client.request.session.deckListOtherUser('bob');
      const listCommand = findLastSessionCommand(Data.Command_DeckListOtherUser_ext);
      expect(captureAllOutbound()).toHaveLength(1);
      expect({ ...listCommand.value }).toEqual({ $typeName: 'Command_DeckListOtherUser', userName: 'bob' });
      answer(listCommand, Data.Response_DeckList_ext, publicDecks);
      expect(store.getState().server.publicDecks.bob.root!.items.map(({ id, name }) => ({ id, name })))
        .toEqual([{ id: 12, name: 'Public Burn' }]);

      client.request.session.deckDownloadPublic(12);
      const downloadCommand = findLastSessionCommand(Data.Command_DeckDownloadPublic_ext);
      expect(captureAllOutbound()).toHaveLength(2);
      expect({ ...downloadCommand.value }).toEqual({ $typeName: 'Command_DeckDownloadPublic', deckId: 12 });
      answer(
        downloadCommand,
        Data.Response_DeckDownload_ext,
        create(Data.Response_DeckDownloadSchema, { deck: '<public-deck/>' }),
      );
      const zeroStats = { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 1 };
      expect(dispatch.mock.calls).toEqual([
        [server.Actions.latencyStatsUpdated({ stats: zeroStats, samplesMs: [0] })],
        [server.Actions.publicDecks({ userName: 'bob', deckList: publicDecks })],
        [server.Actions.publicDeckDownloaded({ deckId: 12, deck: '<public-deck/>' })],
      ]);
    } finally {
      dispatch.mockRestore();
      now.mockRestore();
    }
  });

  it('updates deck and folder visibility only after each server acknowledgement', () => {
    const { client, store } = setup();
    store.dispatch(server.Actions.backendDecks({ deckList: create(Data.Response_DeckListSchema, {
      root: create(Data.ServerInfo_DeckStorage_FolderSchema, {
        items: [
          create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
            id: 3,
            name: 'Burn',
            file: create(Data.ServerInfo_DeckStorage_FileSchema),
          }),
          create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
            name: 'Cube',
            folder: create(Data.ServerInfo_DeckStorage_FolderSchema, {
              items: [create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
                name: 'Inner',
                folder: create(Data.ServerInfo_DeckStorage_FolderSchema),
              })],
            }),
          }),
        ],
      }),
    }) }));

    client.request.session.deckSetVisibility({ deckId: 3, isPublic: true });
    const deckCommand = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
    expect(captureAllOutbound()).toHaveLength(1);
    expect({ ...deckCommand.value }).toEqual({ $typeName: 'Command_DeckSetVisibility', deckId: 3, isPublic: true });
    expect(server.Selectors.getBackendDecks(store.getState())!.root!.items[0].file!.isPublic).toBe(false);
    answer(deckCommand);
    expect(server.Selectors.getBackendDecks(store.getState())!.root!.items[0].file!.isPublic).toBe(true);

    client.request.session.deckSetVisibility({ deckId: 3 });
    const privateCommand = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
    expect(captureAllOutbound()).toHaveLength(2);
    expect({ ...privateCommand.value }).toEqual({ $typeName: 'Command_DeckSetVisibility', deckId: 3 });
    answer(privateCommand);
    expect(store.getState().server.backendDecks!.root!.items[0].file!.isPublic).toBe(false);

    client.request.session.deckSetVisibility({ folderPath: 'Cube/Inner', isPublic: true });
    const folderCommand = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
    expect(captureAllOutbound()).toHaveLength(3);
    expect({ ...folderCommand.value }).toEqual({
      $typeName: 'Command_DeckSetVisibility',
      folderPath: 'Cube/Inner',
      isPublic: true,
    });
    expect(store.getState().server.backendDecks!.root!.items[1].folder!.items[0].folder!.isPublic).toBe(false);
    answer(folderCommand);
    const cube = store.getState().server.backendDecks!.root!.items[1].folder!;
    expect(cube.isPublic).toBe(false);
    expect(cube.items[0].folder!.isPublic).toBe(true);
  });

  it('applies acknowledged nested deck-tree mutations while preserving their ancestors', () => {
    const { client, store } = setup();
    const stored = create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
      id: 2,
      name: 'Elves',
      file: create(Data.ServerInfo_DeckStorage_FileSchema, {
        creationTime: 4,
        bannerCardName: 'Elvish Archdruid',
        bannerCardProvider: 'scryfall',
        tags: ['tribal'],
      }),
    });
    store.dispatch(server.Actions.backendDecks({ deckList: create(Data.Response_DeckListSchema, {
      root: create(Data.ServerInfo_DeckStorage_FolderSchema, {
        items: [
          create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
            name: 'outer',
            folder: create(Data.ServerInfo_DeckStorage_FolderSchema, {
              isPublic: true,
              items: [create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
                name: 'inner',
                folder: create(Data.ServerInfo_DeckStorage_FolderSchema, { items: [stored] }),
              })],
            }),
          }),
          create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
            name: 'untouched',
            folder: create(Data.ServerInfo_DeckStorage_FolderSchema),
          }),
        ],
      }),
    }) }));

    client.request.session.deckSetVisibility({ folderPath: 'outer/inner', isPublic: true });
    const publishInner = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
    expect({ ...publishInner.value }).toEqual({
      $typeName: 'Command_DeckSetVisibility', folderPath: 'outer/inner', isPublic: true,
    });
    answer(publishInner);
    let outerFolder = store.getState().server.backendDecks!.root!.items[0].folder!;
    expect(outerFolder.isPublic).toBe(true);
    expect(outerFolder.items[0].folder!.isPublic).toBe(true);

    client.request.session.deckUpload('outer/inner', 0, '<control/>');
    const upload = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect({ ...upload.value }).toEqual({
      $typeName: 'Command_DeckUpload', path: 'outer/inner', deckId: 0, deckList: '<control/>',
    });
    answer(upload, Data.Response_DeckUpload_ext, create(Data.Response_DeckUploadSchema, {
      newFile: create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
        id: 3, name: 'Control', file: create(Data.ServerInfo_DeckStorage_FileSchema),
      }),
    }));

    client.request.session.deckUpload('outer/missing', 0, '<burn/>');
    const missingUpload = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect({ ...missingUpload.value }).toEqual({
      $typeName: 'Command_DeckUpload', path: 'outer/missing', deckId: 0, deckList: '<burn/>',
    });
    answer(missingUpload, Data.Response_DeckUpload_ext, create(Data.Response_DeckUploadSchema, {
      newFile: create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
        id: 4, name: 'Burn', file: create(Data.ServerInfo_DeckStorage_FileSchema),
      }),
    }));

    client.request.session.deckUpdate(2, '<elves-updated/>', true, 'G');
    const update = findLastSessionCommand(Data.Command_DeckUpload_ext);
    expect({ ...update.value }).toEqual({
      $typeName: 'Command_DeckUpload',
      deckId: 2,
      deckList: '<elves-updated/>',
      isPublic: true,
      colorIdentity: 'G',
    });
    answer(update, Data.Response_DeckUpload_ext, create(Data.Response_DeckUploadSchema, {
      newFile: create(Data.ServerInfo_DeckStorage_TreeItemSchema, {
        id: 2,
        name: 'Elves updated',
        file: create(Data.ServerInfo_DeckStorage_FileSchema, { isPublic: true, colorIdentity: 'G' }),
      }),
    }));
    let innerItems = store.getState().server.backendDecks!.root!.items[0].folder!.items[0].folder!.items;
    expect(innerItems.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 2, name: 'Elves updated' },
      { id: 3, name: 'Control' },
    ]);
    expect({ ...innerItems[0].file! }).toEqual({
      $typeName: 'ServerInfo_DeckStorage_File',
      creationTime: 4,
      isPublic: true,
      bannerCardName: 'Elvish Archdruid',
      bannerCardProvider: 'scryfall',
      colorIdentity: 'G',
      tags: ['tribal'],
    });

    client.request.session.deckNewDir('outer/inner', 'archive');
    const newDir = findLastSessionCommand(Data.Command_DeckNewDir_ext);
    expect({ ...newDir.value }).toEqual({
      $typeName: 'Command_DeckNewDir', path: 'outer/inner', dirName: 'archive',
    });
    answer(newDir);
    innerItems = store.getState().server.backendDecks!.root!.items[0].folder!.items[0].folder!.items;
    expect(innerItems.map(({ name }) => name)).toEqual(['Elves updated', 'Control', 'archive']);
    expect(innerItems[2].folder).toBeDefined();

    client.request.session.deckDelDir('outer/inner/archive');
    const delDir = findLastSessionCommand(Data.Command_DeckDelDir_ext);
    expect({ ...delDir.value }).toEqual({
      $typeName: 'Command_DeckDelDir', path: 'outer/inner/archive',
    });
    answer(delDir);
    innerItems = store.getState().server.backendDecks!.root!.items[0].folder!.items[0].folder!.items;
    expect(innerItems.map(({ name }) => name)).toEqual(['Elves updated', 'Control']);

    client.request.session.deckDel(2);
    const del = findLastSessionCommand(Data.Command_DeckDel_ext);
    expect({ ...del.value }).toEqual({ $typeName: 'Command_DeckDel', deckId: 2 });
    expect(captureAllOutbound()).toHaveLength(7);
    answer(del);

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      client.request.session.deckSetVisibility({ folderPath: 'absent', isPublic: true });
      const absent = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
      expect({ ...absent.value }).toEqual({
        $typeName: 'Command_DeckSetVisibility', folderPath: 'absent', isPublic: true,
      });
      expect(captureAllOutbound()).toHaveLength(8);
      answer(absent);
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }

    const root = store.getState().server.backendDecks!.root!;
    const outer = root.items[0];
    outerFolder = outer.folder!;
    expect(root.items.map(({ name }) => name)).toEqual(['outer', 'untouched']);
    expect(outerFolder.isPublic).toBe(true);
    expect(outerFolder.items[0].folder!.isPublic).toBe(true);
    expect(outerFolder.items.map(({ name }) => name)).toEqual(['inner', 'missing']);
    expect(outerFolder.items[0].folder!.items.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 3, name: 'Control' },
    ]);
    expect(outerFolder.items[1].folder!.items.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: 4, name: 'Burn' },
    ]);
    expect(root.items[1].folder!.isPublic).toBe(false);
  });

  it('keeps unloaded shares and decks unloaded after acknowledged no-op targets', () => {
    const { client, store } = setup();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(store.getState().server.backendDecks).toBeNull();
      expect(store.getState().server.deckSharesMine).toBeNull();

      client.request.session.deckSetVisibility({ folderPath: 'missing', isPublic: true });
      const visibility = findLastSessionCommand(Data.Command_DeckSetVisibility_ext);
      expect({ ...visibility.value }).toEqual({
        $typeName: 'Command_DeckSetVisibility', folderPath: 'missing', isPublic: true,
      });
      answer(visibility);

      client.request.session.deckShareRemove(9);
      const remove = findLastSessionCommand(Data.Command_DeckShareRemove_ext);
      expect({ ...remove.value }).toEqual({ $typeName: 'Command_DeckShareRemove', shareId: 9 });
      expect(captureAllOutbound()).toHaveLength(2);
      answer(remove);

      expect(store.getState().server.backendDecks).toBeNull();
      expect(store.getState().server.deckSharesMine).toBeNull();
      expect(consoleError.mock.calls).toEqual([]);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('dispatches an exact upload failure with its request identity', () => {
    const { client, store } = setup();
    const now = vi.spyOn(performance, 'now').mockReturnValue(100);
    const dispatch = vi.spyOn(store, 'dispatch');
    try {
      client.request.session.deckUpload('/imports', 0, '<deck/>', undefined, undefined, 'upload-1');
      const command = findLastSessionCommand(Data.Command_DeckUpload_ext);
      expect(captureAllOutbound()).toHaveLength(1);
      expect({ ...command.value }).toEqual({
        $typeName: 'Command_DeckUpload',
        path: '/imports',
        deckId: 0,
        deckList: '<deck/>',
      });
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: command.cmdId,
        responseCode: Data.Response_ResponseCode.RespNameNotFound,
      })));
      const zeroStats = { lastMs: 0, medianMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 1 };
      expect(dispatch.mock.calls).toEqual([
        [server.Actions.latencyStatsUpdated({ stats: zeroStats, samplesMs: [0] })],
        [server.Actions.deckUploadFailed({
          path: '/imports',
          responseCode: Data.Response_ResponseCode.RespNameNotFound,
          failure: undefined,
          requestId: 'upload-1',
        })],
      ]);
    } finally {
      dispatch.mockRestore();
      now.mockRestore();
    }
  });
});
