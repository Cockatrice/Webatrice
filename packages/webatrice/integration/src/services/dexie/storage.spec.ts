import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearCardData,
  clearScryfallCache,
  countStoredRecords,
  dexieService,
  HostDTO,
  SettingDTO,
  Stores,
} from '@app/services';
import { APP_USER } from '@app/types';
import { cardDatabaseService } from '../../../../src/services/cardDatabase/CardDatabaseService';
import { resetDexie } from './resetDexie';

const cardsXml = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
  <sets><set><name>LEA</name><longname>Alpha</longname><releasedate>1993-08-05</releasedate></set></sets>
  <cards><card><name>Lightning Bolt</name><set uuid="a">LEA</set></card></cards>
</cockatrice_carddatabase>`;

async function seed(): Promise<void> {
  await dexieService.cards.put({ name: { value: 'Island' } });
  await dexieService.sets.put({ name: { value: 'LEA' } });
  await dexieService.tokens.put({ name: { value: 'Soldier' } });
  await dexieService.formats.put({ formatName: 'modern' });
  await dexieService.info.put({ id: 'singleton', source: 'oracle-local-fs', importedAt: '2026-01-01' });
  await dexieService.cardSources.put({ id: 'main', kind: 'main', fileName: 'cards.xml', origin: 'file', order: 0 });
  await dexieService.cardSourcePayloads.put({ id: 'main', xml: cardsXml });
  await dexieService.setPreferences.put({ code: 'LEA', sortKey: 0, enabled: true, isKnown: true });
  await dexieService.cardDataSettings.put({ id: 'singleton', pictureUrlTemplates: [], alwaysEnableNewSets: false });
  await dexieService.scryfallCache.put({ name: 'Island' });
  await new SettingDTO(APP_USER).save();
  await HostDTO.add({ name: 'Local', host: 'localhost', port: '4748', editable: true });
}

beforeEach(async () => {
  vi.useRealTimers();
  await resetDexie();
  await dexieService.clear([
    Stores.CARDS,
    Stores.SETS,
    Stores.TOKENS,
    Stores.FORMATS,
    Stores.INFO,
    Stores.CARD_SOURCES,
    Stores.CARD_SOURCE_PAYLOADS,
    Stores.SET_PREFERENCES,
    Stores.CARD_DATA_SETTINGS,
    Stores.SCRYFALL_CACHE,
  ]);
  await seed();
});

describe('Storage clears (real Dexie)', () => {
  it('counts the rows of every table', async () => {
    const counts = await countStoredRecords();

    expect(counts).toEqual({
      [Stores.CARDS]: 1,
      [Stores.SETS]: 1,
      [Stores.TOKENS]: 1,
      [Stores.FORMATS]: 1,
      [Stores.INFO]: 1,
      [Stores.CARD_SOURCES]: 1,
      [Stores.CARD_SOURCE_PAYLOADS]: 1,
      [Stores.SET_PREFERENCES]: 1,
      [Stores.CARD_DATA_SETTINGS]: 1,
      [Stores.SCRYFALL_CACHE]: 1,
      [Stores.REPLAYS]: 0,
      [Stores.REPLAY_DATA]: 0,
      [Stores.HOSTS]: 1,
      [Stores.SETTINGS]: 1,
    });
  });

  it('clearing the Scryfall cache leaves the imported card database', async () => {
    await clearScryfallCache();

    const counts = await countStoredRecords();
    expect(counts[Stores.SCRYFALL_CACHE]).toBe(0);
    expect(counts[Stores.CARDS]).toBe(1);
  });

  it('clearing card data removes the loaded files and keeps card preferences, settings, known hosts and the Scryfall cache', async () => {
    await clearCardData();

    const counts = await countStoredRecords();
    expect([counts[Stores.CARDS], counts[Stores.SETS], counts[Stores.TOKENS], counts[Stores.FORMATS], counts[Stores.INFO]])
      .toEqual([0, 0, 0, 0, 0]);
    expect(counts[Stores.CARD_SOURCES]).toBe(0);
    expect(counts[Stores.CARD_SOURCE_PAYLOADS]).toBe(0);
    expect(counts[Stores.SET_PREFERENCES]).toBe(1);
    expect(counts[Stores.CARD_DATA_SETTINGS]).toBe(1);
    expect(counts[Stores.SETTINGS]).toBe(1);
    expect(counts[Stores.HOSTS]).toBe(1);
    expect(counts[Stores.SCRYFALL_CACHE]).toBe(1);
  });
});

describe('Delete card data with loaded sources (real Dexie)', () => {
  it('stays deleted through a reload and keeps the Manage sets choices for the next import', async () => {
    await dexieService.clear([Stores.CARDS, Stores.SETS, Stores.CARD_SOURCES, Stores.SET_PREFERENCES]);
    await cardDatabaseService.addSources([{ fileName: 'cards.xml', xml: cardsXml, origin: 'file' }]);
    const preferences = await dexieService.setPreferences.toArray();
    expect(preferences).toHaveLength(1);

    await clearCardData();
    await cardDatabaseService.reload();

    expect(await dexieService.cards.count()).toBe(0);
    expect(await cardDatabaseService.listSources()).toEqual([]);
    expect(await dexieService.setPreferences.toArray()).toEqual(preferences);
  });

  it('keeps the tokens made in the token editor, loaded and through a reload', async () => {
    await dexieService.clear([Stores.CARDS, Stores.SETS, Stores.TOKENS, Stores.CARD_SOURCES, Stores.CARD_SOURCE_PAYLOADS]);
    await cardDatabaseService.addSources([{ fileName: 'cards.xml', xml: cardsXml, origin: 'file' }]);
    const spirit = { name: { value: 'Spirit' }, set: { value: 'TK' }, token: { value: '1' } };
    await cardDatabaseService.saveCustomTokens([spirit]);

    await clearCardData();

    expect(await dexieService.cards.count()).toBe(0);
    expect((await cardDatabaseService.listSources()).map((s) => s.id)).toEqual(['user-tokens']);
    expect(await cardDatabaseService.getCustomTokens()).toEqual([spirit]);
    expect(await dexieService.tokens.get('Spirit')).toBeDefined();
    expect(await dexieService.sets.get('TK')).toBeDefined();

    await cardDatabaseService.reload();
    expect(await dexieService.tokens.get('Spirit')).toBeDefined();
    expect(await dexieService.cards.count()).toBe(0);
  });
});
