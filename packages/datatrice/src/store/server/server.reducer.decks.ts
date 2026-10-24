import { CaseReducer, PayloadAction } from '@reduxjs/toolkit';
import { clone, create } from '@bufbuild/protobuf';
import {
  Response_DeckList,
  Response_DeckListSchema,
  ServerInfo_DeckShareSummary,
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_Folder,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItem,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { cloneWith } from '../../common/cloneWith';
import { mergeSetFields } from '../../common/mergeSetFields';
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
    return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, { items: [...folder.items, item] });
  }
  const [head, ...tail] = pathSegments;
  const match = folder.items.find(child => child.name === head && child.folder);
  if (match) {
    return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
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
  return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, { items: [...folder.items, created] });
}

function removeById(folder: ServerInfo_DeckStorage_Folder, id: number): ServerInfo_DeckStorage_Folder {
  return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
    items: folder.items
      .filter(item => item.id !== id)
      .map(item =>
        item.folder ? { ...item, folder: removeById(item.folder, id) } : item
      ),
  });
}

function replaceFileById(
  folder: ServerInfo_DeckStorage_Folder,
  id: number,
  replacement: ServerInfo_DeckStorage_TreeItem,
): ServerInfo_DeckStorage_Folder {
  return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
    items: folder.items.map(item => {
      if (item.folder) {
        return { ...item, folder: replaceFileById(item.folder, id, replacement) };
      }
      if (item.id !== id) {
        return item;
      }
      const merged = clone(ServerInfo_DeckStorage_TreeItemSchema, item);
      mergeSetFields(ServerInfo_DeckStorage_TreeItemSchema, merged, replacement);
      if (item.file && replacement.file) {
        merged.file = clone(ServerInfo_DeckStorage_FileSchema, item.file);
        mergeSetFields(ServerInfo_DeckStorage_FileSchema, merged.file, replacement.file);
      }
      return merged;
    }),
  });
}

function removeByPath(folder: ServerInfo_DeckStorage_Folder, pathSegments: string[]): ServerInfo_DeckStorage_Folder {
  if (pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === '')) {
    return folder;
  }
  const [head, ...tail] = pathSegments;
  if (tail.length === 0) {
    return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
      items: folder.items.filter(item => !(item.name === head && item.folder != null))
    });
  }
  return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
    items: folder.items.map(item =>
      item.name === head && item.folder
        ? { ...item, folder: removeByPath(item.folder, tail) }
        : item
    ),
  });
}

function setVisibility(
  folder: ServerInfo_DeckStorage_Folder,
  target: { deckId?: number; folderPath?: string[] },
  isPublic: boolean,
): ServerInfo_DeckStorage_Folder {
  const [head, ...tail] = target.folderPath ?? [];
  return cloneWith(ServerInfo_DeckStorage_FolderSchema, folder, {
    items: folder.items.map(item => {
      if (item.folder) {
        if (target.folderPath && item.name === head) {
          const inner = tail.length === 0
            ? cloneWith(ServerInfo_DeckStorage_FolderSchema, item.folder, { isPublic })
            : setVisibility(item.folder, { folderPath: tail }, isPublic);
          return cloneWith(ServerInfo_DeckStorage_TreeItemSchema, item, { folder: inner });
        }
        if (target.deckId !== undefined) {
          return cloneWith(ServerInfo_DeckStorage_TreeItemSchema, item, {
            folder: setVisibility(item.folder, target, isPublic),
          });
        }
        return item;
      }
      if (item.file && target.deckId !== undefined && item.id === target.deckId) {
        return cloneWith(ServerInfo_DeckStorage_TreeItemSchema, item, {
          file: cloneWith(ServerInfo_DeckStorage_FileSchema, item.file, { isPublic }),
        });
      }
      return item;
    }),
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
  }) as CaseReducer<ServerState, PayloadAction<{ path: string; treeItem: ServerInfo_DeckStorage_TreeItem; requestId?: string }>>,

  deckUpdated: ((state, action) => {
    const { deckId, treeItem } = action.payload;
    if (!state.backendDecks?.root || !treeItem) {
      return;
    }
    state.backendDecks = create(Response_DeckListSchema, {
      root: replaceFileById(state.backendDecks.root, deckId, treeItem),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ deckId: number; treeItem?: ServerInfo_DeckStorage_TreeItem }>>,

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
  }) as CaseReducer<ServerState, PayloadAction<{ path: string; dirName: string; requestId?: string }>>,

  deckDelDir: ((state, action) => {
    if (!state.backendDecks?.root) {
      return;
    }
    state.backendDecks = create(Response_DeckListSchema, {
      root: removeByPath(state.backendDecks.root, splitPath(action.payload.path)),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ path: string }>>,

  deckDownloaded: ((state, action) => {
    const { deckId, deck } = action.payload;
    state.downloadedDeck = { deckId, deck };
  }) as CaseReducer<ServerState, PayloadAction<{ deckId: number; deck: string; requestId?: string }>>,

  deckVisibilityChanged: ((state, action) => {
    const { deckId, folderPath, isPublic } = action.payload;
    if (!state.backendDecks?.root) {
      return;
    }
    const target = folderPath ? { folderPath: splitPath(folderPath) } : { deckId };
    state.backendDecks = create(Response_DeckListSchema, {
      root: setVisibility(state.backendDecks.root, target, isPublic),
    });
  }) as CaseReducer<ServerState, PayloadAction<{ deckId?: number; folderPath?: string; isPublic: boolean }>>,

  deckSharesMine: ((state, action) => {
    state.deckSharesMine = action.payload.shares;
  }) as CaseReducer<ServerState, PayloadAction<{ shares: ServerInfo_DeckShareSummary[] }>>,

  deckShareRemoved: ((state, action) => {
    if (state.deckSharesMine) {
      state.deckSharesMine = state.deckSharesMine.filter(share => share.id !== action.payload.shareId);
    }
  }) as CaseReducer<ServerState, PayloadAction<{ shareId: number }>>,

  publicDecks: ((state, action) => {
    state.publicDecks[action.payload.userName] = action.payload.deckList;
  }) as CaseReducer<ServerState, PayloadAction<{ userName: string; deckList: Response_DeckList }>>,
};
