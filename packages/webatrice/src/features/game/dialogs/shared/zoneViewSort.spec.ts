import {
  buildCardGroups,
  compareCards,
  groupCards,
  matchesQuery,
  placeholderMeta,
  type SortMode,
  type ZoneViewCardMetadata,
} from './zoneViewSort';
import { catalogT } from '../../__test-utils__/catalogT';
import zoneView from './ZoneView.i18n.json';

const t = catalogT(zoneView);

const card = (name: string, overrides: Partial<ZoneViewCardMetadata> = {}): ZoneViewCardMetadata => ({
  name,
  type_line: null,
  cmc: null,
  colors: [],
  set: null,
  power: null,
  toughness: null,
  ...overrides,
});

const BOLT = card('Lightning Bolt', { type_line: 'Instant', cmc: 1, colors: ['R'], set: 'lea' });
const BEAR = card('Grizzly Bears', { type_line: 'Creature — Bear', cmc: 2, colors: ['G'], set: 'm10', power: '2', toughness: '2' });
const GOYF = card('Tarmogoyf', { type_line: 'Creature — Lhurgoyf', cmc: 2, colors: ['G'], set: 'fut', power: '*', toughness: '1+*' });
const ELK = card('Ancient Elk', { type_line: 'Creature — Elk', cmc: 5, colors: ['W', 'G'], set: 'm10', power: '2', toughness: '5' });
const FOREST = card('Forest', { type_line: 'Basic Land — Forest', cmc: 0, set: 'm10' });
const UNKNOWN = card('Mystery');

const ALL = [BOLT, BEAR, GOYF, ELK, FOREST, UNKNOWN];
const enrich = (cards: ZoneViewCardMetadata[]) =>
  cards.map((meta, i) => ({ handCard: { id: String(i), name: meta.name, scryfallId: '' }, meta }));

describe('zoneViewSort', () => {
  describe('matchesQuery', () => {
    it.each([
      ['', ALL.map((c) => c.name)],
      ['bear', ['Grizzly Bears']],
      ['t:creature', ['Grizzly Bears', 'Tarmogoyf', 'Ancient Elk']],
      ['t:creature c:wg', ['Ancient Elk']],
      ['c:green', ['Grizzly Bears', 'Tarmogoyf', 'Ancient Elk']],
      ['c:x', []],
      ['cmc:2', ['Grizzly Bears', 'Tarmogoyf']],
      ['mv:0', ['Forest', 'Mystery']],
      ['set:M10 n:elk', ['Ancient Elk']],
      ['t:', ALL.map((c) => c.name)],
      ['foo:bolt', []],
    ])('%j', (query, names) => {
      expect(ALL.filter((c) => matchesQuery(c, query)).map((c) => c.name)).toEqual(names);
    });
  });

  describe('compareCards', () => {
    it.each([
      ['none', ALL.map((c) => c.name)],
      ['name', ['Ancient Elk', 'Forest', 'Grizzly Bears', 'Lightning Bolt', 'Mystery', 'Tarmogoyf']],
      ['cmc', ['Forest', 'Mystery', 'Lightning Bolt', 'Grizzly Bears', 'Tarmogoyf', 'Ancient Elk']],
      ['type', ['Mystery', 'Forest', 'Grizzly Bears', 'Ancient Elk', 'Tarmogoyf', 'Lightning Bolt']],
      ['color', ['Forest', 'Mystery', 'Grizzly Bears', 'Tarmogoyf', 'Lightning Bolt', 'Ancient Elk']],
      ['set', ['Mystery', 'Tarmogoyf', 'Lightning Bolt', 'Ancient Elk', 'Forest', 'Grizzly Bears']],
      ['pt', ['Grizzly Bears', 'Ancient Elk', 'Tarmogoyf', 'Forest', 'Lightning Bolt', 'Mystery']],
    ] as const)('by %s', (mode: SortMode, names) => {
      expect([...ALL].sort((a, b) => compareCards(a, b, mode)).map((c) => c.name)).toEqual(names);
    });
  });

  describe('compareCards by pt', () => {
    it('orders non-creatures by name whatever the input order', () => {
      const names = [UNKNOWN, BOLT, FOREST].sort((a, b) => compareCards(a, b, 'pt')).map((c) => c.name);
      expect(names).toEqual(['Forest', 'Lightning Bolt', 'Mystery']);
    });

    it('breaks a name tie by set', () => {
      const m10 = card('Forest', { set: 'm10' });
      const lea = card('Forest', { set: 'lea' });
      expect([m10, lea].sort((a, b) => compareCards(a, b, 'pt'))).toEqual([lea, m10]);
    });
  });

  describe('groupCards', () => {
    const groups = (mode: Parameters<typeof groupCards>[1]) =>
      groupCards(enrich(ALL), mode, t).map((g) => [g.label, g.cards.map((c) => c.meta.name)]);

    it('keeps one unlabeled group, or none for an empty view', () => {
      expect(groups('none')).toEqual([['', ALL.map((c) => c.name)]]);
      expect(groupCards([], 'none', t)).toEqual([]);
    });

    it('groups by primary type in desktop order, unknown types under Other', () => {
      expect(groups('type')).toEqual([
        ['Creature', ['Grizzly Bears', 'Tarmogoyf', 'Ancient Elk']],
        ['Instant', ['Lightning Bolt']],
        ['Land', ['Forest']],
        ['Other', ['Mystery']],
      ]);
    });

    it('groups by mana value ascending, unknown as 0', () => {
      expect(groups('cmc')).toEqual([
        ['Mana 0', ['Forest', 'Mystery']],
        ['Mana 1', ['Lightning Bolt']],
        ['Mana 2', ['Grizzly Bears', 'Tarmogoyf']],
        ['Mana 5', ['Ancient Elk']],
      ]);
    });

    it('groups mono colors in WUBRG order, then multicolor, then colorless', () => {
      expect(groups('color')).toEqual([
        ['R', ['Lightning Bolt']],
        ['G', ['Grizzly Bears', 'Tarmogoyf']],
        ['GW', ['Ancient Elk']],
        ['Colorless', ['Forest', 'Mystery']],
      ]);
    });
  });
});

describe('buildCardGroups', () => {
  const hand = (id: string, name: string) => ({ id, name, scryfallId: '' });
  const meta = new Map<string, ZoneViewCardMetadata>([
    ['Bears', { ...placeholderMeta('Bears'), type_line: 'Creature — Bear', cmc: 2 }],
    ['Forest', { ...placeholderMeta('Forest'), type_line: 'Basic Land — Forest', cmc: 0 }],
  ]);
  const cards = [hand('1', 'Forest'), hand('2', 'Bears'), hand('3', 'Mystery')];

  it('filters by the query, sorts, then groups, treating an unanswered name as unknown', () => {
    expect(buildCardGroups(cards, meta, { sortBy: 'name', groupBy: 'type' }, t).map((g) => [g.label, g.cards.map((c) => c.handCard.id)]))
      .toEqual([['Creature', ['2']], ['Land', ['1']], ['Other', ['3']]]);
    expect(buildCardGroups(
      cards,
      meta,
      { query: 't:land', sortBy: 'none', groupBy: 'none' },
      t,
    ).map((g) => g.cards.map((c) => c.handCard.id)))
      .toEqual([['1']]);
    expect(buildCardGroups(cards, meta, { query: 'nothing', sortBy: 'none', groupBy: 'type' }, t)).toEqual([]);
  });
});
