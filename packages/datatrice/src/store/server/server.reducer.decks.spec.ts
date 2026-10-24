import { create } from '@bufbuild/protobuf';
import {
  Response_DeckListSchema,
  ServerInfo_DeckShareSummarySchema,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';

import { makeDeckList, makeDeckTreeItem, makeServerState } from '../../testing/fixtures/server';
import { Actions } from './server.actions';
import { serverReducer } from './server.reducer';

it('merges sparse deck acknowledgements by field presence without mutating the prior file', () => {
  const item = create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 7, name: 'Before', file: {
      creationTime: 1, isPublic: true, colorIdentity: 'WU',
      bannerCardName: 'Island', bannerCardProvider: 'art', tags: ['control'],
    },
  });
  const before = serverReducer(undefined, Actions.backendDecks({ deckList: create(Response_DeckListSchema, { root: { items: [item] } }) }));
  const after = serverReducer(before, Actions.deckUpdated({ deckId: 7, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 7, name: 'After', file: { creationTime: 2, isPublic: false },
  }) }));
  expect(after.backendDecks!.root!.items[0].file).toMatchObject({
    creationTime: 2, isPublic: false, colorIdentity: 'WU',
    bannerCardName: 'Island', bannerCardProvider: 'art', tags: ['control'],
  });
  expect(before.backendDecks!.root!.items[0].file).toMatchObject({ creationTime: 1, isPublic: true });
  const cleared = serverReducer(after, Actions.deckUpdated({ deckId: 7, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 7, file: { colorIdentity: '', bannerCardName: '', bannerCardProvider: '' },
  }) }));
  expect(cleared.backendDecks!.root!.items[0].file).toMatchObject({ colorIdentity: '', bannerCardName: '', bannerCardProvider: '' });
});

function storage() {
  const deck = makeDeckTreeItem({ id: 1, name: 'Burn', file: create(ServerInfo_DeckStorage_FileSchema, { creationTime: 5 }) });
  const nested = makeDeckTreeItem({ id: 2, name: 'Elves', file: create(ServerInfo_DeckStorage_FileSchema, {}) });
  const inner = makeDeckTreeItem({ id: 0, name: 'inner', folder: create(ServerInfo_DeckStorage_FolderSchema, { items: [nested] }) });
  const outer = makeDeckTreeItem({ id: 0, name: 'outer', folder: create(ServerInfo_DeckStorage_FolderSchema, { items: [inner] }) });
  return makeServerState({
    backendDecks: makeDeckList({ root: create(ServerInfo_DeckStorage_FolderSchema, { items: [deck, outer] }) }),
  });
}

function share(id: number) {
  return create(ServerInfo_DeckShareSummarySchema, { id, name: `share ${id}`, itemCount: 1 });
}

describe('deckVisibilityChanged', () => {
  it('sets a deck\'s own public bit by id', () => {
    const state = storage();
    const result = serverReducer(state, Actions.deckVisibilityChanged({ deckId: 2, isPublic: true }));
    const nested = result.backendDecks!.root!.items[1].folder!.items[0].folder!.items[0];
    expect(nested.file!.isPublic).toBe(true);
    expect(result.backendDecks!.root!.items[0].file!.isPublic).toBe(false);
  });

  it('keeps the rest of the deck entry', () => {
    const result = serverReducer(storage(), Actions.deckVisibilityChanged({ deckId: 1, isPublic: true }));
    const deck = result.backendDecks!.root!.items[0];
    expect(deck.name).toBe('Burn');
    expect(deck.file!.creationTime).toBe(5);
  });

  it('sets a folder\'s bit by path without touching the decks under it', () => {
    const result = serverReducer(storage(), Actions.deckVisibilityChanged({ folderPath: 'outer/inner', isPublic: true }));
    const outer = result.backendDecks!.root!.items[1];
    const inner = outer.folder!.items[0];
    expect(outer.folder!.isPublic).toBe(false);
    expect(inner.folder!.isPublic).toBe(true);
    expect(inner.folder!.items[0].file!.isPublic).toBe(false);
  });

  it('replaces the stored messages instead of mutating them', () => {
    const state = storage();
    const before = state.backendDecks!.root!.items[0];
    const result = serverReducer(state, Actions.deckVisibilityChanged({ deckId: 1, isPublic: true }));
    expect(before.file!.isPublic).toBe(false);
    expect(result.backendDecks!.root!.items[0]).not.toBe(before);
  });

  it('is a no-op before the deck list has loaded', () => {
    const state = makeServerState({ backendDecks: null });
    expect(serverReducer(state, Actions.deckVisibilityChanged({ deckId: 1, isPublic: true })).backendDecks).toBeNull();
  });

  it('leaves every folder private when the requested path is absent', () => {
    const result = serverReducer(storage(), Actions.deckVisibilityChanged({ folderPath: 'missing', isPublic: true }));
    expect(result.backendDecks!.root!.items.map((item) => ({
      name: item.name,
      isPublic: item.folder?.isPublic ?? item.file?.isPublic,
    }))).toEqual([
      { name: 'Burn', isPublic: false },
      { name: 'outer', isPublic: false },
    ]);
    expect(result.backendDecks!.root!.items[1].folder!.items[0].folder!.isPublic).toBe(false);
  });
});

describe('published folders after tree mutations', () => {
  const uploaded = makeDeckTreeItem({ id: 3, name: 'Control', file: create(ServerInfo_DeckStorage_FileSchema) });
  const updated = makeDeckTreeItem({ id: 2, name: 'Elves updated', file: create(ServerInfo_DeckStorage_FileSchema) });

  it.each([
    {
      operation: 'upload',
      action: Actions.deckUpload({ path: 'outer/inner', treeItem: uploaded }),
      names: ['Elves', 'empty', 'Control'],
    },
    {
      operation: 'upload into a missing folder',
      action: Actions.deckUpload({ path: 'outer/inner/new', treeItem: uploaded }),
      names: ['Elves', 'empty', 'new'],
    },
    {
      operation: 'update',
      action: Actions.deckUpdated({ deckId: 2, treeItem: updated }),
      names: ['Elves updated', 'empty'],
    },
    {
      operation: 'delete',
      action: Actions.deckDelete({ deckId: 2 }),
      names: ['empty'],
    },
    {
      operation: 'delete outside the published folder',
      action: Actions.deckDelete({ deckId: 1 }),
      names: ['Elves', 'empty'],
    },
    {
      operation: 'new folder',
      action: Actions.deckNewDir({ path: 'outer/inner', dirName: 'new' }),
      names: ['Elves', 'empty', 'new'],
    },
    {
      operation: 'delete folder',
      action: Actions.deckDelDir({ path: 'outer/inner/empty' }),
      names: ['Elves'],
    },
  ])('preserves published ancestors after $operation', ({ action, names }) => {
    let state = serverReducer(storage(), Actions.deckNewDir({ path: 'outer/inner', dirName: 'empty' }));
    state = serverReducer(state, Actions.deckVisibilityChanged({ folderPath: 'outer', isPublic: true }));
    state = serverReducer(state, Actions.deckVisibilityChanged({ folderPath: 'outer/inner', isPublic: true }));
    const before = state.backendDecks!.root!.items[1].folder!;

    const result = serverReducer(state, action);
    const outer = result.backendDecks!.root!.items.find(item => item.name === 'outer')!.folder!;
    const inner = outer.items[0].folder!;

    expect(outer.isPublic).toBe(true);
    expect(inner.isPublic).toBe(true);
    expect(inner.items.map(item => item.name)).toEqual(names);
    expect(result.backendDecks!.root!.isPublic).toBe(false);
    expect(outer).not.toBe(before);
    expect(before.items[0].folder!.items.map(item => item.name)).toEqual(['Elves', 'empty']);
  });
});

describe('deckSharesMine / deckShareRemoved', () => {
  it('stores the caller\'s share links', () => {
    const result = serverReducer(makeServerState(), Actions.deckSharesMine({ shares: [share(1), share(2)] }));
    expect(result.deckSharesMine!.map((s) => s.id)).toEqual([1, 2]);
  });

  it('drops a revoked share', () => {
    const state = makeServerState({ deckSharesMine: [share(1), share(2)] });
    const result = serverReducer(state, Actions.deckShareRemoved({ shareId: 1 }));
    expect(result.deckSharesMine!.map((s) => s.id)).toEqual([2]);
  });

  it('leaves an unlisted share list unlisted', () => {
    const result = serverReducer(makeServerState({ deckSharesMine: null }), Actions.deckShareRemoved({ shareId: 1 }));
    expect(result.deckSharesMine).toBeNull();
  });
});

describe('publicDecks', () => {
  it('stores a user\'s public deck tree by name', () => {
    const deckList = makeDeckList();
    const result = serverReducer(makeServerState(), Actions.publicDecks({ userName: 'bob', deckList }));
    expect(result.publicDecks.bob).toBe(deckList);
  });

  it('is cleared with the rest of the session', () => {
    const state = makeServerState({ publicDecks: { bob: makeDeckList() }, deckSharesMine: [share(1)] });
    const result = serverReducer(state, Actions.clearStore());
    expect(result.publicDecks).toEqual({});
    expect(result.deckSharesMine).toBeNull();
  });
});
