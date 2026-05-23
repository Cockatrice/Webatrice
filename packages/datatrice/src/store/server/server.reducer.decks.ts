import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { create } from '@bufbuild/protobuf';
import {
  Response_DeckList,
  Response_DeckListSchema,
  ServerInfo_DeckStorage_Folder,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItem,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { ServerState } from './server.interfaces';

function splitPath(path: string): string[] {
  return path ? path.split('/') : [];
}

function insertAtPath(
  folder: ServerInfo_DeckStorage_Folder,
  pathSegments: string[],
  item: ServerInfo_DeckStorage_TreeItem,
): ServerInfo_DeckStorage_Folder {
  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === '')) {
    return create(ServerInfo_DeckStorage_FolderSchema, { items: [...folder.items, item] });
  }
  const [head, ...tail] = pathSegments;
  const match = folder.items.find(child => child.name === head && child.folder);
  if (match) {
    return create(ServerInfo_DeckStorage_FolderSchema, {
      items: folder.items.map(child =>
        child === match
          ? { ...child, folder: insertAtPath(child.folder!, tail, item) }
          : child
      ),
    });
  }
  const created: ServerInfo_DeckStorage_TreeItem = create(ServerInfo_DeckStorage_TreeItemSchema, {
    id: 0, name: head, folder: insertAtPath(create(ServerInfo_DeckStorage_FolderSchema, { items: [] }), tail, item)
  });
  return create(ServerInfo_DeckStorage_FolderSchema, { items: [...folder.items, created] });
}

function removeById(folder: ServerInfo_DeckStorage_Folder, id: number): ServerInfo_DeckStorage_Folder {
  return create(ServerInfo_DeckStorage_FolderSchema, {
    items: folder.items
      .filter(item => item.id !== id)
      .map(item =>
        item.folder ? { ...item, folder: removeById(item.folder, id) } : item
      ),
  });
}

function removeByPath(folder: ServerInfo_DeckStorage_Folder, pathSegments: string[]): ServerInfo_DeckStorage_Folder {
  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === '')) {
    return folder;
  }
  const [head, ...tail] = pathSegments;
  if (tail.length === 0) {
    return create(ServerInfo_DeckStorage_FolderSchema, {
      items: folder.items.filter(item => !(item.name === head && item.folder != null))
    });
  }
  return create(ServerInfo_DeckStorage_FolderSchema, {
    items: folder.items.map(item =>
      item.name === head && item.folder
        ? { ...item, folder: removeByPath(item.folder, tail) }
        : item
    ),
  });
}

export const deckReducers = {
  backendDecks: ((state, action) => {
    state.backendDecks = action.payload.deckList;
  }) as CaseReducer<ServerState, PayloadAction<{ deckList: Response_DeckList }>>,

  deckUpload: ((state, action) => {
    if (!state.backendDecks?.root) {
      return;
    }
    state.backendDecks = create(Response_DeckListSchema, {
      root: insertAtPath(state.backendDecks.root, splitPath(action.payload.path), action.payload.treeItem),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ path: string; treeItem: ServerInfo_DeckStorage_TreeItem }>>,

  deckDelete: ((state, action) => {
    if (!state.backendDecks?.root) {
      return;
    }
    state.backendDecks = create(Response_DeckListSchema, {
      root: removeById(state.backendDecks.root, action.payload.deckId),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ deckId: number }>>,

  deckNewDir: ((state, action) => {
    if (!state.backendDecks?.root) {
      return;
    }
    const newFolder: ServerInfo_DeckStorage_TreeItem = create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: 0, name: action.payload.dirName, folder: create(ServerInfo_DeckStorage_FolderSchema, { items: [] })
    });
    state.backendDecks = create(Response_DeckListSchema, {
      root: insertAtPath(state.backendDecks.root, splitPath(action.payload.path), newFolder),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ path: string; dirName: string }>>,

  deckDelDir: ((state, action) => {
    if (!state.backendDecks?.root) {
      return;
    }
    state.backendDecks = create(Response_DeckListSchema, {
      root: removeByPath(state.backendDecks.root, splitPath(action.payload.path)),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ path: string }>>,

  deckDownloaded: ((state, action) => {
    state.downloadedDeck = action.payload;
  }) as CaseReducer<ServerState, PayloadAction<{ deckId: number; deck: string }>>,
};
