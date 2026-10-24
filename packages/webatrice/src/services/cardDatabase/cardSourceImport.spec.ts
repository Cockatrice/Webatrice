const hoisted = vi.hoisted(() => ({
  listSources: vi.fn(),
  hasSourceXml: vi.fn(),
  addSources: vi.fn(),
  getCustomTokens: vi.fn(),
  saveCustomTokens: vi.fn(),
  summary: vi.fn(),
}));

vi.mock('./CardDatabaseService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./CardDatabaseService')>()),
  cardDatabaseService: hoisted,
}));

import { MAX_LOCAL_XML_BYTES } from './cardImportLimits';
import { customSetFileName, importCustomSetFiles, saveCardSourceScan, scanCardSourceFiles } from './cardSourceImport';

const setXml = (code: string, card: string) => `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>${code}</name><longname>${code} set</longname></set></sets>
  <cards><card><name>${card}</name><set>${code}</set></card></cards>
</cockatrice_carddatabase>`;

const tokensXml = (...names: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>TK</name></set></sets>
  <cards>${names.map((name) => `<card><name>${name}</name><set>TK</set><token>1</token></card>`).join('')}</cards>
</cockatrice_carddatabase>`;

const xmlFile = (name: string, content: string) => new File([content], name, { type: 'application/xml' });

const rebuild = { summary: { cards: 2, sets: 2, tokens: 0, formats: 0 }, unknownSets: ['CUB'], allNewSetsEnabled: false };

beforeEach(() => {
  hoisted.listSources.mockResolvedValue([]);
  hoisted.hasSourceXml.mockResolvedValue(false);
  hoisted.addSources.mockResolvedValue(rebuild);
  hoisted.getCustomTokens.mockResolvedValue([]);
  hoisted.saveCustomTokens.mockResolvedValue([]);
  hoisted.summary.mockResolvedValue({ cards: 0, sets: 1, tokens: 1, formats: 0 });
});

describe('scanCardSourceFiles', () => {
  it('names each file by its role, including browser copies of the Oracle files', async () => {
    const scan = await scanCardSourceFiles([
      xmlFile('cards (1).xml', setXml('LEA', 'Bolt')),
      xmlFile('tokens.xml', tokensXml('Soldier')),
      xmlFile('spoiler.xml', setXml('NEW', 'Fresh')),
      xmlFile('Cube.xml', setXml('CUB', 'Homebrew')),
      xmlFile('TK.xml', tokensXml('My Token')),
    ]);

    expect(scan.sources.map(({ name, kind }) => [name, kind])).toEqual([
      ['Cube.xml', 'custom'],
      ['TK.xml', 'user-tokens'],
      ['cards (1).xml', 'main'],
      ['spoiler.xml', 'spoiler'],
      ['tokens.xml', 'tokens'],
    ]);
    expect(scan.skipped).toEqual([]);
    expect(scan.failed).toEqual([]);
  });

  it('skips files that are not XML and fails unreadable or oversized ones without reading them', async () => {
    const huge = xmlFile('huge.xml', setXml('BIG', 'Big'));
    Object.defineProperty(huge, 'size', { value: MAX_LOCAL_XML_BYTES + 1 });
    const read = vi.spyOn(huge, 'text');

    const scan = await scanCardSourceFiles([xmlFile('notes.txt', 'hi'), xmlFile('bad.xml', '<nope'), huge]);

    expect(scan.sources).toEqual([]);
    expect(scan.skipped).toEqual([{ name: 'notes.txt', reason: 'unsupported' }]);
    expect(scan.failed).toEqual([
      { name: 'bad.xml', reason: 'invalid', detail: 'Cockatrice XML is malformed' },
      { name: 'huge.xml', reason: 'too-large' },
    ]);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('importCustomSetFiles', () => {
  it('adds every XML as a custom set in path order, as desktop loads customsets/', async () => {
    const summary = await importCustomSetFiles([
      xmlFile('b.xml', setXml('BBB', 'Bee')),
      xmlFile('cards.xml', setXml('CUB', 'Homebrew')),
      xmlFile('a.xml', setXml('AAA', 'Ay')),
    ]);

    expect(hoisted.addSources).toHaveBeenCalledWith([
      expect.objectContaining({ fileName: 'a.xml', kind: 'custom', origin: 'file' }),
      expect.objectContaining({ fileName: 'b.xml', kind: 'custom', origin: 'file' }),
      expect.objectContaining({ fileName: 'cards.xml', kind: 'custom', origin: 'file' }),
    ]);
    expect(summary).toEqual({
      imported: [{ name: 'a.xml' }, { name: 'b.xml' }, { name: 'cards.xml' }],
      skipped: [],
      failed: [],
      unknownSets: ['CUB'],
      counts: rebuild.summary,
    });
  });

  it('keeps spoiler.xml a spoiler, as the database tab always has', async () => {
    await importCustomSetFiles([xmlFile('spoiler.xml', setXml('NEW', 'Fresh'))]);

    expect(hoisted.addSources).toHaveBeenCalledWith([expect.objectContaining({ kind: 'spoiler' })]);
  });

  it('skips a custom set that is already loaded and replaces one whose contents changed', async () => {
    const same = setXml('AAA', 'Ay');
    hoisted.listSources.mockResolvedValue([
      { id: 'custom:01:a.xml', kind: 'custom', fileName: 'a.xml' },
      { id: 'custom:02:b.xml', kind: 'custom', fileName: 'b.xml' },
    ]);
    hoisted.hasSourceXml.mockImplementation(async (id: string, xml: string) => id === 'custom:01:a.xml' && xml === same);

    const summary = await importCustomSetFiles([xmlFile('a.xml', same), xmlFile('b.xml', setXml('BBB', 'New Bee'))]);

    expect(hoisted.addSources).toHaveBeenCalledWith([expect.objectContaining({ fileName: 'b.xml', replaces: 'custom:02:b.xml' })]);
    expect(summary.imported).toEqual([{ name: 'b.xml', replaced: true }]);
    expect(summary.skipped).toEqual([{ name: 'a.xml', reason: 'duplicate' }]);
  });

  it('tells same-named custom sets in different folders apart', async () => {
    hoisted.listSources.mockResolvedValue([
      { id: 'custom:01:A/cards.xml', kind: 'custom', fileName: 'A/cards.xml' },
      { id: 'custom:02:B/cards.xml', kind: 'custom', fileName: 'B/cards.xml' },
    ]);
    hoisted.hasSourceXml.mockImplementation(async (id: string) => id === 'custom:01:A/cards.xml');
    const at = (path: string, xml: string) => {
      const file = xmlFile('cards.xml', xml);
      Object.defineProperty(file, 'webkitRelativePath', { value: path });
      return file;
    };

    const summary = await importCustomSetFiles([
      at('Cockatrice/customsets/A/cards.xml', setXml('AAA', 'Ay')),
      at('Cockatrice/customsets/B/cards.xml', setXml('BBB', 'New Bee')),
    ]);

    expect(summary.skipped).toEqual([{ name: 'A/cards.xml', reason: 'duplicate' }]);
    expect(summary.imported).toEqual([{ name: 'B/cards.xml', replaced: true }]);
    expect(hoisted.addSources).toHaveBeenCalledWith([
      expect.objectContaining({ fileName: 'B/cards.xml', replaces: 'custom:02:B/cards.xml' }),
    ]);
  });

  it('writes nothing when every file is already loaded', async () => {
    hoisted.listSources.mockResolvedValue([{ id: 'custom:01:a.xml', kind: 'custom', fileName: 'a.xml' }]);
    hoisted.hasSourceXml.mockResolvedValue(true);

    const summary = await importCustomSetFiles([xmlFile('a.xml', setXml('AAA', 'Ay'))]);

    expect(hoisted.addSources).not.toHaveBeenCalled();
    expect(summary.counts).toBeNull();
    expect(summary.skipped).toEqual([{ name: 'a.xml', reason: 'duplicate' }]);
  });

  it('puts desktop TK.xml tokens into the editable custom tokens, skipping ones already there', async () => {
    hoisted.getCustomTokens.mockResolvedValue([
      { name: { value: 'Old Token' }, set: { value: 'TK' }, token: { value: '1' } },
    ]);

    const summary = await importCustomSetFiles([xmlFile('TK.xml', tokensXml('Old Token', 'New Token'))]);

    expect(hoisted.addSources).not.toHaveBeenCalled();
    expect(hoisted.saveCustomTokens).toHaveBeenCalledWith([expect.objectContaining({ name: { value: 'New Token' } })]);
    expect(summary.imported).toEqual([{ name: 'TK.xml' }]);
    expect(summary.counts).toEqual({ cards: 0, sets: 1, tokens: 1, formats: 0 });
  });

  it('reports the files it could not save', async () => {
    hoisted.addSources.mockRejectedValue(new Error('quota'));

    const summary = await importCustomSetFiles([xmlFile('a.xml', setXml('AAA', 'Ay'))]);

    expect(summary.imported).toEqual([]);
    expect(summary.failed).toEqual([{ name: 'a.xml', reason: 'save-failed', detail: 'quota' }]);
  });
});

describe('customSetFileName', () => {
  it.each([
    ['Cube.xml', 'Cube.xml'],
    ['customsets/Cube.xml', 'Cube.xml'],
    ['Cockatrice/customsets/A/cards.xml', 'A/cards.xml'],
    ['MySets/A/cards.xml', 'A/cards.xml'],
    ['C:\\Cockatrice\\customsets\\TK.xml', 'TK.xml'],
  ])('stores %s as %s', (path, fileName) => {
    expect(customSetFileName(path)).toBe(fileName);
  });
});

describe('saveCardSourceScan', () => {
  it('replaces the stored Oracle file of the same role', async () => {
    hoisted.listSources.mockResolvedValue([{ id: 'main', kind: 'main', fileName: 'cards.xml' }]);
    const scan = await scanCardSourceFiles([xmlFile('cards.xml', setXml('LEA', 'Bolt'))]);

    const summary = await saveCardSourceScan(scan);

    expect(hoisted.addSources).toHaveBeenCalledWith([expect.objectContaining({ kind: 'main', replaces: 'main' })]);
    expect(summary.imported).toEqual([{ name: 'cards.xml', replaced: true }]);
  });
});
