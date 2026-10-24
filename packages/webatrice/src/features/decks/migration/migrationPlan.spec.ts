import { create } from '@bufbuild/protobuf';
import {
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  type ServerInfo_DeckStorage_Folder,
} from '@cockatrice/sockatrice/generated';

import type { SourceFile } from './fileSources';
import {
  classifySources, groupByFolder, groupByReason, planDeckImport, scanDeckSource, targetPathOf, type ScannedDeck,
} from './migrationPlan';

function source(path: string, text = '', size?: number): SourceFile {
  const file = new File([text], path.split('/').pop()!);
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return { file, path };
}

type Item = { name: string; deck?: boolean; children?: ServerInfo_DeckStorage_Folder };

function folder(items: Item[]): ServerInfo_DeckStorage_Folder {
  return create(ServerInfo_DeckStorage_FolderSchema, {
    items: items.map((item, i) => create(ServerInfo_DeckStorage_TreeItemSchema, {
      id: i + 1,
      name: item.name,
      ...(item.deck
        ? { file: { creationTime: 0 } }
        : { folder: item.children ?? create(ServerInfo_DeckStorage_FolderSchema, { items: [] }) }),
    })),
  });
}

function scanned(id: string, name: string, folderPath: string[]): ScannedDeck {
  return {
    id, path: `${id}.cod`, fileName: `${id}.cod`, folder: folderPath,
    deck: { name, meta: { v: 1, updatedAt: '' }, cards: [{ name: 'Opt', quantity: 1, category: 'main' }], format: '' },
  };
}

describe('classifySources', () => {
  it('sorts a picked Cockatrice data folder into decks (with subfolders), replays and custom sets', () => {
    const result = classifySources([
      source('Cockatrice/decks/Modern/Burn/burn.cod'),
      source('Cockatrice/decks/atraxa.txt'),
      source('Cockatrice/replays/2025/replay_1.cor'),
      source('Cockatrice/customsets/01.mine.xml'),
      source('Cockatrice/customsets/TK.xml'),
      source('Cockatrice/cards.xml'),
      source('Cockatrice/settings/servers.ini'),
      source('Cockatrice/pics/CUSTOM/x.png'),
    ]);
    expect(result.decks.map((d) => [d.file.name, d.folder])).toEqual([['burn.cod', ['Modern', 'Burn']], ['atraxa.txt', []]]);
    expect(result.replays.map((r) => r.path)).toEqual(['Cockatrice/replays/2025/replay_1.cor']);
    expect(result.customSets.map((c) => c.file.name)).toEqual(['01.mine.xml', 'TK.xml']);
    expect(result.cardDatabase).toEqual(['cards.xml']);
    expect(result.otherCount).toBe(2);
  });

  it('treats a picked decks folder as the deck root', () => {
    const result = classifySources([source('MyDecks/Modern/burn.cod'), source('MyDecks/edh.cod')]);
    expect(result.decks.map((d) => d.folder)).toEqual([['Modern'], []]);
  });

  it('keeps loose dropped files at the top level', () => {
    const result = classifySources([source('burn.cod'), source('extra.xml')]);
    expect(result.decks[0].folder).toEqual([]);
    expect(result.customSets.map((c) => c.file.name)).toEqual(['extra.xml']);
  });
});

describe('scanDeckSource', () => {
  it('reads a deck and reports empty and oversized files', async () => {
    const base = { folder: [] };
    expect((await scanDeckSource({ ...source('a.txt', '4 Lightning Bolt'), ...base }, 'a')).deck?.cards).toHaveLength(1);
    expect((await scanDeckSource({ ...source('b.txt', '???'), ...base }, 'b')).problem).toBe('empty');
    expect((await scanDeckSource({ ...source('c.cod', 'x', 3_000_000), ...base }, 'c')).problem).toBe('tooLarge');
  });
});

describe('planDeckImport', () => {
  const root = folder([
    { name: 'Imported from desktop', children: folder([{ name: 'Burn', deck: true }]) },
  ]);
  const decks = [scanned('a', 'Burn', []), scanned('b', 'Atraxa', ['Commander', 'Testing'])];
  const selected = new Set(['a', 'b']);

  it('creates missing folders parents first and skips decks that are already there', () => {
    const plan = planDeckImport(decks, root, { destination: 'Imported from desktop', choice: 'skip', selected });
    expect(plan.folders).toEqual([
      { parent: 'Imported from desktop', name: 'Commander' },
      { parent: 'Imported from desktop/Commander', name: 'Testing' },
    ]);
    expect(plan.uploads).toEqual([{ id: 'b', path: 'Imported from desktop/Commander/Testing', name: 'Atraxa' }]);
    expect(plan.skipped).toEqual([{ id: 'a', reason: 'exists' }]);
  });

  it('keeps both by numbering the new copy', () => {
    const plan = planDeckImport([...decks, scanned('c', 'burn', [])], root, {
      destination: 'Imported from desktop', choice: 'keepBoth', selected: new Set(['a', 'c']),
    });
    expect(plan.uploads.map((u) => [u.name, u.renamedFrom])).toEqual([['Burn (2)', 'Burn'], ['burn (3)', 'burn']]);
  });

  it('imports to the top level with an empty destination and leaves out unselected decks', () => {
    const plan = planDeckImport(decks, root, { destination: '', choice: 'skip', selected: new Set(['a']) });
    expect(plan).toEqual({ folders: [], uploads: [{ id: 'a', path: '', name: 'Burn' }], skipped: [] });
  });

  it('turns slashes in folder names into dashes', () => {
    expect(targetPathOf('Desk/top', ['A/B'])).toBe('Desk-top/A-B');
  });
});

describe('grouping', () => {
  it('groups decks by folder in natural order', () => {
    const decks = [{ name: 'Burn 10', folder: ['Modern'] }, { name: 'Burn 2', folder: ['Modern'] }, { name: 'Zur', folder: [] }];
    expect(groupByFolder(decks).map((g) => [g.folder, g.decks.map((d) => d.name)])).toEqual([
      ['', ['Zur']], ['Modern', ['Burn 2', 'Burn 10']],
    ]);
  });

  it('groups skipped decks by reason', () => {
    expect(groupByReason([{ name: 'A', reason: 'exists' }, { name: 'B', reason: 'empty' }, { name: 'C', reason: 'exists' }]))
      .toEqual([{ reason: 'exists', names: ['A', 'C'] }, { reason: 'empty', names: ['B'] }]);
  });
});
