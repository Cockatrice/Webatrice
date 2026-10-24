import { create } from '@bufbuild/protobuf';
import {
  ServerInfo_DeckStorage_FileSchema,
  ServerInfo_DeckStorage_FolderSchema,
  ServerInfo_DeckStorage_TreeItemSchema,
  type ServerInfo_DeckStorage_TreeItem,
} from '@cockatrice/sockatrice/generated';

import { deckVisibility, findDeckFile, flattenFolder, formatDeckAge } from './deckTree';

function file(id: number, name: string, creationTime: number): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    id,
    name,
    file: create(ServerInfo_DeckStorage_FileSchema, { creationTime }),
  });
}

function folder(name: string, items: ServerInfo_DeckStorage_TreeItem[]): ServerInfo_DeckStorage_TreeItem {
  return create(ServerInfo_DeckStorage_TreeItemSchema, {
    name,
    folder: create(ServerInfo_DeckStorage_FolderSchema, { items }),
  });
}

describe('findDeckFile', () => {
  it('finds a single file at the root or in a nested folder', () => {
    const rootFile = file(1, 'Root', 100);
    const nestedFile = file(2, 'Nested', 200);
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [rootFile, folder('Outer', [folder('Inner', [nestedFile])])],
    });
    expect(findDeckFile(root, 1)).toBe(rootFile.file);
    expect(findDeckFile(root, 2)).toBe(nestedFile.file);
    expect(findDeckFile(root, 3)).toBeUndefined();
    expect(findDeckFile(undefined, 1)).toBeUndefined();
  });
});

describe('flattenFolder', () => {
  it('collects files from nested folders with their path', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [
        file(1, 'Root', 100),
        folder('Cube', [file(2, 'Inner', 300), folder('Old', [file(3, 'Deep', 200)])]),
      ],
    });
    expect(flattenFolder(root, '').map(({ id, name, path, creationTime }) => ({ id, name, path, creationTime }))).toEqual([
      { id: 1, name: 'Root', path: '', creationTime: 100 },
      { id: 2, name: 'Inner', path: 'Cube', creationTime: 300 },
      { id: 3, name: 'Deep', path: 'Cube/Old', creationTime: 200 },
    ]);
  });

  it('names an unnamed file by its id and skips id-less entries', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [file(4, '', 1), file(0, 'Ghost', 2)],
    });
    expect(flattenFolder(root, 'A')).toEqual([
      expect.objectContaining({ id: 4, name: 'Deck #4', path: 'A', creationTime: 1 }),
    ]);
  });

  it('carries the visibility and color identity a move must keep', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [
        create(ServerInfo_DeckStorage_TreeItemSchema, {
          id: 5,
          name: 'Public',
          file: create(ServerInfo_DeckStorage_FileSchema, { creationTime: 1, isPublic: true, colorIdentity: 'UR' }),
        }),
      ],
    });
    expect(flattenFolder(root, '')).toEqual([expect.objectContaining({ isPublic: true, colorIdentity: 'UR' })]);
  });
});

describe('flattenFolder visibility', () => {
  const file = (id: number, isPublic = false) =>
    create(ServerInfo_DeckStorage_TreeItemSchema, { id, name: `D${id}`, file: create(ServerInfo_DeckStorage_FileSchema, { isPublic }) });

  it('marks a deck public by its own bit and inherited under a public folder', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [
        file(1, true),
        file(2),
        create(ServerInfo_DeckStorage_TreeItemSchema, {
          name: 'Shared',
          folder: create(ServerInfo_DeckStorage_FolderSchema, {
            isPublic: true,
            items: [file(3), file(4, true)],
          }),
        }),
      ],
    });
    expect(flattenFolder(root, '').map((d) => [d.id, d.visibility])).toEqual([
      [1, 'public'],
      [2, 'private'],
      [3, 'inherited'],
      [4, 'public'],
    ]);
  });

  it('inherits from above the flattened folder when told', () => {
    const folder = create(ServerInfo_DeckStorage_FolderSchema, { items: [file(5)] });
    expect(flattenFolder(folder, 'A', true)[0].visibility).toBe('inherited');
  });
});

describe('deckVisibility', () => {
  it.each([
    [true, false, 'public'],
    [true, true, 'public'],
    [false, true, 'inherited'],
    [undefined, false, 'private'],
  ] as const)('own bit %s, under a public folder %s → %s', (own, under, expected) => {
    expect(deckVisibility(own, under)).toBe(expected);
  });
});

describe('formatDeckAge', () => {
  const now = Date.UTC(2026, 0, 31, 12, 0, 0);
  const secondsAgo = (s: number) => now / 1000 - s;

  it('builds one relative-time formatter per locale, not one per row', () => {
    const Real = Intl.RelativeTimeFormat;
    const RelativeTimeFormat = vi.spyOn(Intl, 'RelativeTimeFormat')
      .mockImplementation(function relativeTimeFormat(...args: ConstructorParameters<typeof Real>) {
        return new Real(...args);
      } as unknown as typeof Real);
    for (const s of [125, 3 * 3600, 2 * 86400]) {
      formatDeckAge(secondsAgo(s), 'nl', now);
    }
    expect(RelativeTimeFormat.mock.calls.filter(([locale]) => locale === 'nl')).toHaveLength(1);
    RelativeTimeFormat.mockRestore();
  });

  it.each([
    [125, '2m ago'],
    [3 * 3600 + 5, '3h ago'],
    [2 * 86400 + 5, '2d ago'],
  ])('formats %ss as %s', (age, expected) => {
    expect(formatDeckAge(secondsAgo(age), 'en', now)).toEqual({ text: expected });
  });

  it('formats in the given language', () => {
    expect(formatDeckAge(secondsAgo(125), 'de', now)).toEqual({
      text: new Intl.RelativeTimeFormat('de', { style: 'narrow' }).format(-2, 'minute'),
    });
  });

  it('returns keys for "just now" and a missing timestamp', () => {
    expect(formatDeckAge(secondsAgo(30), 'en', now)).toEqual({ key: 'justNow' });
    expect(formatDeckAge(0, 'en', now)).toEqual({ key: 'unknown' });
  });

  it('falls back to a localized date after a week', () => {
    expect(formatDeckAge(secondsAgo(8 * 86400), 'en', now)).toEqual({
      text: new Date(now - 8 * 86400 * 1000).toLocaleDateString('en'),
    });
    expect(formatDeckAge(secondsAgo(8 * 86400), '', now)).toEqual({
      text: new Date(now - 8 * 86400 * 1000).toLocaleDateString(),
    });
  });
});

describe('flattenFolder stored preview', () => {
  it('carries the banner and tags the server stores, and omits them when empty', () => {
    const root = create(ServerInfo_DeckStorage_FolderSchema, {
      items: [
        create(ServerInfo_DeckStorage_TreeItemSchema, {
          id: 1, name: 'A', file: create(ServerInfo_DeckStorage_FileSchema, {
            bannerCardName: 'Island', bannerCardProvider: 'abc', tags: ['Ramp'],
          }),
        }),
        file(2, 'B', 0),
      ],
    });
    const [a, b] = flattenFolder(root, '');
    expect(a).toMatchObject({ bannerCardName: 'Island', bannerCardProvider: 'abc', tags: ['Ramp'] });
    expect(b).not.toHaveProperty('bannerCardName');
    expect(b).not.toHaveProperty('tags');
  });
});
