import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toBinary } from '@bufbuild/protobuf';
import { GameReplaySchema } from '@cockatrice/sockatrice/generated';

import {
  cardDatabaseService,
  dexieService,
  importCustomSetFiles,
  importReplayFiles,
  REPLAY_LIBRARY_ROOT,
  ReplayFileDTO,
} from '@app/services';
import { buildReplay, sayContainer } from '../../../../src/services/replay/__mocks__/fixtures';
import { resetDexie } from './resetDexie';

const replayBytes = (message: string) => toBinary(GameReplaySchema, buildReplay([sayContainer(0, message)]));

function fileAt(path: string, content: BlobPart): File {
  const file = new File([content], path.split('/').at(-1)!);
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
}

const customSetXml = (card: string) => `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>CUS</name><longname>Custom</longname></set></sets>
  <cards><card><name>${card}</name><set>CUS</set></card></cards>
</cockatrice_carddatabase>`;

const desktopTokensXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>TK</name><longname>Dummy set containing tokens</longname></set></sets>
  <cards><card><name>Goblin Friend</name><set>TK</set><token>1</token></card></cards>
</cockatrice_carddatabase>`;

beforeEach(async () => {
  vi.useRealTimers();
  await resetDexie();
  await Promise.all([
    dexieService.cards.clear(),
    dexieService.sets.clear(),
    dexieService.tokens.clear(),
    dexieService.formats.clear(),
    dexieService.info.clear(),
    dexieService.cardSources.clear(),
    dexieService.cardSourcePayloads.clear(),
    dexieService.setPreferences.clear(),
    dexieService.cardDataSettings.clear(),
  ]);
});

describe('importReplayFiles (real Dexie)', () => {
  it('keeps one folder level and skips replays already in the library on a second run', async () => {
    const files = () => [
      fileAt('Cockatrice/replays/2025/a.cor', replayBytes('a') as BlobPart),
      fileAt('Cockatrice/replays/b.cor', replayBytes('b') as BlobPart),
      fileAt('Cockatrice/replays/notes.txt', 'x'),
    ];

    const first = await importReplayFiles(files());
    const second = await importReplayFiles(files());

    expect(first.imported).toEqual([{ name: 'a.cor', folder: '2025' }, { name: 'b.cor' }]);
    expect(second.imported).toEqual([]);
    expect(second.skipped.map(({ name, reason }) => [name, reason])).toEqual([
      ['a.cor', 'duplicate'],
      ['b.cor', 'duplicate'],
      ['notes.txt', 'unsupported'],
    ]);
    const root = await ReplayFileDTO.listFolder(REPLAY_LIBRARY_ROOT);
    const folder = root.find((entry) => entry.kind === 'folder');
    expect(folder?.name).toBe('2025');
    expect((await ReplayFileDTO.listFolder(folder!.id)).map((entry) => entry.name)).toEqual(['a.cor']);
    expect(root.filter((entry) => entry.kind === 'replay').map((entry) => entry.name)).toEqual(['b.cor']);
  });
});

describe('importCustomSetFiles (real Dexie)', () => {
  it('loads a custom set, skips it when unchanged and replaces it when it changed', async () => {
    const first = await importCustomSetFiles([fileAt('customsets/Cube.xml', customSetXml('Homebrew'))]);
    const again = await importCustomSetFiles([fileAt('customsets/Cube.xml', customSetXml('Homebrew'))]);
    const changed = await importCustomSetFiles([fileAt('customsets/Cube.xml', customSetXml('Homebrew Mk II'))]);

    expect(first.imported).toEqual([{ name: 'Cube.xml' }]);
    expect(first.unknownSets).toEqual([]);
    expect(again.skipped).toEqual([{ name: 'Cube.xml', reason: 'duplicate' }]);
    expect(changed.imported).toEqual([{ name: 'Cube.xml', replaced: true }]);
    const sources = await cardDatabaseService.listSources();
    expect(sources.map((source) => [source.kind, source.fileName])).toEqual([['custom', 'Cube.xml']]);
    expect(await dexieService.cards.get('Homebrew Mk II')).toBeDefined();
    expect(await dexieService.cards.get('Homebrew')).toBeUndefined();
  });

  it('keeps same-named sets in different folders apart and a replaced set in its load position', async () => {
    const sharedXml = (code: string, text: string) => `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>${code}</name></set></sets>
  <cards><card><name>Shared</name><text>${text}</text><set>${code}</set></card></cards>
</cockatrice_carddatabase>`;
    const textOfShared = async () => (await dexieService.cards.get('Shared'))?.text?.value;

    await importCustomSetFiles([
      fileAt('customsets/A/cards.xml', sharedXml('AAA', 'from A')),
      fileAt('customsets/B/cards.xml', sharedXml('BBB', 'from B')),
    ]);
    expect(await textOfShared()).toBe('from A');

    const rerun = await importCustomSetFiles([
      fileAt('Cockatrice/customsets/A/cards.xml', sharedXml('AAA', 'from A, edited')),
      fileAt('Cockatrice/customsets/B/cards.xml', sharedXml('BBB', 'from B')),
    ]);

    expect(rerun.imported).toEqual([{ name: 'A/cards.xml', replaced: true }]);
    expect(rerun.skipped).toEqual([{ name: 'B/cards.xml', reason: 'duplicate' }]);
    const sources = await cardDatabaseService.listSources();
    expect(sources.map((source) => [source.fileName, source.order])).toEqual([['A/cards.xml', 1], ['B/cards.xml', 2]]);
    expect(await textOfShared()).toBe('from A, edited');
  });

  it('puts desktop TK.xml into the token editor\'s custom tokens', async () => {
    const summary = await importCustomSetFiles([fileAt('customsets/TK.xml', desktopTokensXml)]);

    expect(summary.imported).toEqual([{ name: 'TK.xml' }]);
    expect((await cardDatabaseService.getCustomTokens()).map((token) => token.name.value)).toEqual(['Goblin Friend']);
    expect(await dexieService.tokens.get('Goblin Friend')).toBeDefined();
  });
});
