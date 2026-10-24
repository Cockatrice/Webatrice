import { create } from '@bufbuild/protobuf';
import {
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  type ServerInfo_DeckStorage_TreeItem,
} from '@cockatrice/sockatrice/generated';

import {
  allDeckFolderPaths,
  checkNewFolderName,
  deckFolderEntry,
  deckFolderTree,
  deckPathCrumbs,
  decksUnderFolder,
  findDeckFolder,
  isUnderPublicFolder,
  joinDeckPath,
  listPublicDecks,
  listDeckFolder,
  parentDeckPath,
} from './deckFolders';

function file(id: number, name: string, creationTime: number): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    id, name, file: create(ServerInfo_DeckStorage_FileSchema, { creationTime }),
  });
}

function folder(name: string, items: ServerInfo_DeckStorage_TreeItem[]): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, { name, folder: create(ServerInfo_DeckStorage_FolderSchema, { items }) });
}

const root = create(ServerInfo_DeckStorage_FolderSchema, {
  items: [
    file(1, 'Root deck', 100),
    folder('Modern', [file(2, 'Burn', 300), folder('Old', [file(3, 'Affinity', 200)]), folder('Empty', [])]),
    folder('Cube', []),
    file(4, 'Newer root deck', 400),
  ],
});

describe('paths', () => {
  it('joins, splits and crumbs folder paths', () => {
    expect(joinDeckPath('', 'Modern')).toBe('Modern');
    expect(joinDeckPath('Modern', 'Old')).toBe('Modern/Old');
    expect(parentDeckPath('Modern/Old')).toBe('Modern');
    expect(parentDeckPath('Modern')).toBe('');
    expect(deckPathCrumbs('Modern/Old')).toEqual([{ name: 'Modern', path: 'Modern' }, { name: 'Old', path: 'Modern/Old' }]);
    expect(deckPathCrumbs('')).toEqual([]);
  });
});

describe('findDeckFolder', () => {
  it('walks the tree by folder name, never into a file', () => {
    expect(findDeckFolder(root, '')).toBe(root);
    expect(findDeckFolder(root, 'Modern/Old')?.items.map((i) => i.name)).toEqual(['Affinity']);
    expect(findDeckFolder(root, 'Root deck')).toBeUndefined();
    expect(findDeckFolder(root, 'Modern/Missing')).toBeUndefined();
    expect(findDeckFolder(undefined, 'Modern')).toBeUndefined();
  });
});

describe('listDeckFolder', () => {
  it('lists the root: subfolders by name with recursive counts, then its own decks newest first', () => {
    const view = listDeckFolder(root, '');
    expect(view.folders).toEqual([
      { name: 'Cube', path: 'Cube', deckCount: 0, directDeckCount: 0, folderCount: 0, visibility: 'private' },
      { name: 'Modern', path: 'Modern', deckCount: 2, directDeckCount: 1, folderCount: 2, visibility: 'private' },
    ]);
    expect(view.decks.map((d) => d.name)).toEqual(['Newer root deck', 'Root deck']);
  });

  it('counts a folder holding only subfolders as having no decks of its own to share', () => {
    const nested = create(ServerInfo_DeckStorage_FolderSchema, { items: [folder('Outer', [folder('Inner', [file(5, 'x', 1)])])] });
    expect(listDeckFolder(nested, '').folders[0]).toMatchObject({ deckCount: 1, directDeckCount: 0 });
  });

  it('lists a nested folder with paths relative to the root', () => {
    const view = listDeckFolder(root, 'Modern');
    expect(view.path).toBe('Modern');
    expect(view.folders.map((f) => f.path)).toEqual(['Modern/Empty', 'Modern/Old']);
    expect(view.decks).toEqual([expect.objectContaining({ id: 2, name: 'Burn', path: 'Modern', creationTime: 300 })]);
  });

  it('falls back to the root for a folder that no longer exists', () => {
    expect(listDeckFolder(root, 'Gone').path).toBe('');
    expect(listDeckFolder(undefined, 'Gone')).toEqual({ path: '', folders: [], decks: [] });
  });
});

describe('decksUnderFolder / allDeckFolderPaths', () => {
  it('collects every deck below a folder', () => {
    expect(decksUnderFolder(root, 'Modern').map((d) => [d.name, d.path])).toEqual([
      ['Burn', 'Modern'],
      ['Affinity', 'Modern/Old'],
    ]);
    expect(decksUnderFolder(root, 'Gone')).toEqual([]);
  });

  it('lists every folder path, root first', () => {
    expect(allDeckFolderPaths(root)).toEqual(['', 'Cube', 'Modern', 'Modern/Empty', 'Modern/Old']);
    expect(allDeckFolderPaths(undefined)).toEqual(['']);
  });
});

describe('public folders', () => {
  const publicTree = create(ServerInfo_DeckStorage_FolderSchema, {
    items: [
      create(ServerInfo_DeckStorage_TreeItemSchema, {
        name: 'Shared',
        folder: create(ServerInfo_DeckStorage_FolderSchema, {
          isPublic: true,
          items: [folder('Inner', [file(7, 'Inherited', 1)])],
        }),
      }),
      folder('Private', [file(8, 'Hidden', 1)]),
    ],
  });

  it('finds a public folder at or above a path', () => {
    expect(isUnderPublicFolder(publicTree, 'Shared')).toBe(true);
    expect(isUnderPublicFolder(publicTree, 'Shared/Inner')).toBe(true);
    expect(isUnderPublicFolder(publicTree, 'Private')).toBe(false);
    expect(isUnderPublicFolder(publicTree, '')).toBe(false);
    expect(isUnderPublicFolder(undefined, 'Shared')).toBe(false);
  });

  it('shows a folder\'s own bit and what its contents inherit', () => {
    expect(listDeckFolder(publicTree, '').folders.map((f) => [f.name, f.visibility])).toEqual([
      ['Private', 'private'],
      ['Shared', 'public'],
    ]);
    const inner = listDeckFolder(publicTree, 'Shared/Inner');
    expect(inner.decks.map((d) => d.visibility)).toEqual(['inherited']);
    expect(listDeckFolder(publicTree, 'Shared').folders[0].visibility).toBe('inherited');
    expect(decksUnderFolder(publicTree, 'Shared/Inner')[0].visibility).toBe('inherited');
  });
});

describe('listPublicDecks', () => {
  it('flattens another user\'s public tree with folder paths', () => {
    expect(listPublicDecks(root).map((d) => [d.id, d.name, d.path])).toEqual([
      [1, 'Root deck', ''],
      [2, 'Burn', 'Modern'],
      [3, 'Affinity', 'Modern/Old'],
      [4, 'Newer root deck', ''],
    ]);
    expect(listPublicDecks(undefined)).toEqual([]);
  });
});

describe('checkNewFolderName', () => {
  it('trims the name and turns "/" into "-", like desktop', () => {
    expect(checkNewFolderName('  a/b ', '', [])).toEqual({ name: 'a-b' });
  });

  it('refuses empty, too long and sibling-duplicate names', () => {
    expect(checkNewFolderName('   ', '', [])).toEqual({ problem: 'empty' });
    expect(checkNewFolderName('x'.repeat(250), 'abcde', [])).toEqual({ problem: 'tooLong' });
    expect(checkNewFolderName('x'.repeat(249), 'abcde', [])).toEqual({ name: 'x'.repeat(249) });
    expect(checkNewFolderName('Cube', '', ['Cube', 'Modern'])).toEqual({ problem: 'exists' });
  });
});

describe('deckFolderTree', () => {
  it('nests folders by name with recursive deck counts and inherited visibility', () => {
    const publicFolder = create(ServerInfo_DeckStorage_TreeItemSchema, {
      name: 'Cube',
      folder: create(ServerInfo_DeckStorage_FolderSchema, { isPublic: true, items: [folder('Old', [file(5, 'E', 1)])] }),
    });
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [
        file(1, 'Root', 1),
        folder('Modern', []),
        folder('Commander', [file(2, 'A', 1), folder('Testing', [file(3, 'B', 1), file(4, 'C', 1)])]),
        publicFolder,
      ],
    });
    expect(deckFolderTree(root)).toEqual([
      { name: 'Commander', path: 'Commander', deckCount: 3, visibility: 'private', children: [
        { name: 'Testing', path: 'Commander/Testing', deckCount: 2, visibility: 'private', children: [] },
      ] },
      { name: 'Cube', path: 'Cube', deckCount: 1, visibility: 'public', children: [
        { name: 'Old', path: 'Cube/Old', deckCount: 1, visibility: 'inherited', children: [] },
      ] },
      { name: 'Modern', path: 'Modern', deckCount: 0, visibility: 'private', children: [] },
    ]);
    expect(deckFolderTree(undefined)).toEqual([]);
  });
});

describe('deckFolderEntry', () => {
  it('describes a nested folder and nothing for the root or a missing path', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [folder('Commander', [file(1, 'A', 1), folder('Testing', [file(2, 'B', 1)])])],
    });
    expect(deckFolderEntry(root, 'Commander')).toMatchObject({ name: 'Commander', deckCount: 2, folderCount: 1 });
    expect(deckFolderEntry(root, 'Commander/Testing')).toMatchObject({ name: 'Testing', deckCount: 1, folderCount: 0 });
    expect(deckFolderEntry(root, '')).toBeNull();
    expect(deckFolderEntry(root, 'Nope')).toBeNull();
  });
});
