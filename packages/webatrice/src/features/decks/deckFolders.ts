import type { ServerInfo_DeckStorage_File, ServerInfo_DeckStorage_Folder } from '@cockatrice/sockatrice/generated';

import { deckVisibility, flattenFolder, type DeckVisibility, type FlatDeck } from './deckTree';

export const MAX_DECK_PATH_LENGTH = 0xff;

export interface DeckFolderEntry {
  name: string;
  path: string;
  deckCount: number;
  directDeckCount: number;
  folderCount: number;
  visibility: DeckVisibility;
}

export interface DeckFolderView {
  path: string;
  folders: DeckFolderEntry[];
  decks: FlatDeck[];
}

export function joinDeckPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function parentDeckPath(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash < 0 ? '' : path.slice(0, slash);
}

export function deckPathCrumbs(path: string): { name: string; path: string }[] {
  if (!path) {
    return [];
  }
  const segments = path.split('/');
  return segments.map((name, i) => ({ name, path: segments.slice(0, i + 1).join('/') }));
}

export function isUnderPublicFolder(root: ServerInfo_DeckStorage_Folder | undefined, path: string): boolean {
  if (!root) {
    return false;
  }
  let folder: ServerInfo_DeckStorage_Folder | undefined = root;
  if (folder.isPublic) {
    return true;
  }
  for (const segment of path ? path.split('/') : []) {
    folder = folder?.items.find((item) => item.folder && item.name === segment)?.folder;
    if (!folder) {
      return false;
    }
    if (folder.isPublic) {
      return true;
    }
  }
  return false;
}

export function findDeckFolder(
  root: ServerInfo_DeckStorage_Folder | undefined,
  path: string,
): ServerInfo_DeckStorage_Folder | undefined {
  if (!root || !path) {
    return root;
  }
  let folder: ServerInfo_DeckStorage_Folder | undefined = root;
  for (const segment of path.split('/')) {
    folder = folder?.items.find((item) => item.folder && item.name === segment)?.folder;
    if (!folder) {
      return undefined;
    }
  }
  return folder;
}

function countFolders(folder: ServerInfo_DeckStorage_Folder): number {
  return folder.items.reduce((sum, item) => sum + (item.folder ? 1 + countFolders(item.folder) : 0), 0);
}

export function listDeckFolder(root: ServerInfo_DeckStorage_Folder | undefined, path: string): DeckFolderView {
  const folder = findDeckFolder(root, path);
  const shownPath = folder ? path : '';
  const shown = folder ?? root;
  if (!shown) {
    return { path: '', folders: [], decks: [] };
  }
  const inherited = isUnderPublicFolder(root, shownPath);
  const folders: DeckFolderEntry[] = shown.items
    .filter((item) => item.folder)
    .map((item) => {
      const childPath = joinDeckPath(shownPath, item.name);
      return {
        name: item.name,
        path: childPath,
        deckCount: flattenFolder(item.folder!, childPath).length,
        directDeckCount: item.folder!.items.filter((child) => !child.folder).length,
        folderCount: countFolders(item.folder!),
        visibility: deckVisibility(item.folder!.isPublic, inherited),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const decks = flattenFolder({ ...shown, items: shown.items.filter((item) => !item.folder) }, shownPath, inherited)
    .sort((a, b) => b.creationTime - a.creationTime);
  return { path: shownPath, folders, decks };
}

export function deckFolderEntry(root: ServerInfo_DeckStorage_Folder | undefined, path: string): DeckFolderEntry | null {
  if (!path) {
    return null;
  }
  return listDeckFolder(root, parentDeckPath(path)).folders.find((entry) => entry.path === path) ?? null;
}

export function decksUnderFolder(root: ServerInfo_DeckStorage_Folder | undefined, path: string): FlatDeck[] {
  const folder = findDeckFolder(root, path);
  return folder ? flattenFolder(folder, path, isUnderPublicFolder(root, parentDeckPath(path))) : [];
}

export interface PublicDeckEntry {
  id: number;
  name: string;
  path: string;
  file: ServerInfo_DeckStorage_File;
}

export function listPublicDecks(folder: ServerInfo_DeckStorage_Folder | undefined, path = ''): PublicDeckEntry[] {
  if (!folder) {
    return [];
  }
  return folder.items.flatMap((item) => {
    if (item.file && item.id) {
      return [{ id: item.id, name: item.name || `Deck #${item.id}`, path, file: item.file }];
    }
    return item.folder ? listPublicDecks(item.folder, joinDeckPath(path, item.name)) : [];
  });
}

export function allDeckFolderPaths(root: ServerInfo_DeckStorage_Folder | undefined): string[] {
  const out = [''];
  const walk = (folder: ServerInfo_DeckStorage_Folder, path: string) => {
    for (const item of folder.items) {
      if (item.folder) {
        const childPath = joinDeckPath(path, item.name);
        out.push(childPath);
        walk(item.folder, childPath);
      }
    }
  };
  if (root) {
    walk(root, '');
  }
  return [out[0], ...out.slice(1).sort((a, b) => a.localeCompare(b))];
}

export interface DeckFolderNode {
  name: string;
  path: string;
  deckCount: number;
  visibility: DeckVisibility;
  children: DeckFolderNode[];
}

export function deckFolderTree(root: ServerInfo_DeckStorage_Folder | undefined): DeckFolderNode[] {
  const walk = (folder: ServerInfo_DeckStorage_Folder, path: string, inherited: boolean): DeckFolderNode[] =>
    folder.items
      .filter((item) => item.folder)
      .map((item) => {
        const childPath = joinDeckPath(path, item.name);
        return {
          name: item.name,
          path: childPath,
          deckCount: flattenFolder(item.folder!, childPath).length,
          visibility: deckVisibility(item.folder!.isPublic, inherited),
          children: walk(item.folder!, childPath, inherited || !!item.folder!.isPublic),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  return root ? walk(root, '', !!root.isPublic) : [];
}

export type FolderNameProblem = 'empty' | 'tooLong' | 'exists';

export function checkNewFolderName(
  name: string,
  parentPath: string,
  siblings: readonly string[],
): { name: string } | { problem: FolderNameProblem } {
  const cleaned = name.trim().replace(/\//g, '-');
  if (!cleaned) {
    return { problem: 'empty' };
  }
  if (joinDeckPath(parentPath, cleaned).length > MAX_DECK_PATH_LENGTH) {
    return { problem: 'tooLong' };
  }
  if (siblings.includes(cleaned)) {
    return { problem: 'exists' };
  }
  return { name: cleaned };
}
