import 'fake-indexeddb/auto';

import { dexieService } from '../dexie/DexieService';
import { cockatriceXmlParser } from './CockatriceXmlParser';
import { writeCockatriceXml } from './CockatriceXmlWriter';
import legacyXml from './__fixtures__/cards-v3.xml?raw';

vi.unmock('dexie');

it('normalizes v3 properties, colors and printing attributes into the v4 shape', () => {
  const parsed = cockatriceXmlParser.parseSource(legacyXml);
  expect(parsed.cards).toEqual([{
    name: { value: 'Legacy Golem' },
    text: { value: 'Create a Soldier token. <rules> & more.' },
    prop: { value: {
      manacost: { value: '2WU' }, cmc: { value: '4' }, type: { value: 'Legendary Artifact Creature — Golem' },
      maintype: { value: 'Creature' }, pt: { value: '3/4' }, loyalty: { value: '5' }, colors: { value: 'WUBR' },
    } },
    tablerow: { value: '2' }, cipt: { value: '1' }, landscapeOrientation: { value: '1' }, upsidedown: { value: '1' },
    set: [
      { value: 'ABC', muid: '123', uuid: 'legacy-uuid', picurl: 'https://example.test/golem.png', num: '12', rarity: 'rare' },
      { value: 'XYZ', muid: '456', uuid: 'reprint-uuid', picurl: 'https://example.test/reprint.png', num: '34', rarity: 'mythic' },
    ],
    related: { value: 'Soldier Token', count: '2' },
  }]);
  expect(parsed.tokens).toEqual([{
    name: { value: 'Soldier Token' }, token: { value: '1' }, tablerow: { value: '2' },
    prop: { value: {
      type: { value: 'Token Creature - Soldier' }, maintype: { value: 'Creature' }, pt: { value: '1/1' }, colors: { value: 'W' },
    } },
    set: { value: 'ABC', picurl: 'https://example.test/soldier.png' },
    'reverse-related': { value: 'Legacy Golem' },
  }]);
  expect(parsed.sets).toEqual([
    { name: { value: 'ABC' }, longname: { value: 'Legacy & Friends' },
      settype: { value: 'Expansion' }, releasedate: { value: '2015-07-17' } },
    { name: { value: 'XYZ' }, longname: { value: 'Legacy Reprints' },
      settype: { value: 'Masters' }, releasedate: { value: '2016-06-10' } },
  ]);
  const written = writeCockatriceXml({ sets: parsed.sets, cards: [...parsed.cards, ...parsed.tokens] });
  expect(cockatriceXmlParser.parseSource(written)).toEqual(parsed);
});

it.each([
  ['Legendary Artifact Creature - Golem', 'Creature'],
  ['Legendary Artifact Creature — Golem', 'Creature'],
  ['Instant // Sorcery', 'Instant'],
  ['  Basic   Land  ', 'Land'],
])('derives the desktop main type from %s', (type, maintype) => {
  const parsed = cockatriceXmlParser.parse(`<cockatrice_carddatabase version="3"><cards>
    <card><name>Example</name><type>${type}</type></card>
  </cards></cockatrice_carddatabase>`);
  expect(parsed.cards?.[0].prop?.value).toEqual({
    type: { value: type }, maintype: { value: maintype }, colors: { value: '' },
  });
});

it('skips v3 cards without a name while importing the remaining records', () => {
  const parsed = cockatriceXmlParser.parse(`<cockatrice_carddatabase version="3"><cards>
    <card><text>Missing name</text><set>BAD</set></card>
    <card><name>   </name></card>
    <card><name/></card>
    <card><name>Kept</name><set>GOOD</set></card>
  </cards></cockatrice_carddatabase>`);
  expect(parsed.cards).toEqual([expect.objectContaining({ name: { value: 'Kept' } })]);
});

it('keeps v3 import results indexed by name.value in the actual Dexie tables', async () => {
  const parsed = cockatriceXmlParser.parseSource(legacyXml);
  const tables = [dexieService.cards, dexieService.sets, dexieService.tokens];
  await Promise.all(tables.map(table => table.clear()));
  try {
    await dexieService.cards.bulkPut(parsed.cards);
    await dexieService.sets.bulkPut(parsed.sets);
    await dexieService.tokens.bulkPut(parsed.tokens);
    expect(await dexieService.cards.where('name.value').equals('Legacy Golem').first()).toMatchObject(parsed.cards[0]);
    expect(await dexieService.sets.get('ABC')).toMatchObject(parsed.sets[0]);
    expect(await dexieService.tokens.get('Soldier Token')).toMatchObject(parsed.tokens[0]);
  } finally {
    await Promise.all(tables.map(table => table.clear()));
  }
});
