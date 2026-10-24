import type { LookupResult } from '@app/services';

import {
  cardLegality,
  cardMatchesCondition,
  deckLegality,
  legalityFacts,
  toFormatRules,
  type FormatRules,
  type LegalityFacts,
} from './deckLegality';
import type { DeckCard } from './types';

const bolt: LegalityFacts = {
  name: 'Lightning Bolt',
  text: 'Lightning Bolt deals 3 damage to any target.',
  properties: { type: 'Instant' },
  legalities: { modern: 'legal', vintage: 'legal', standard: '' },
};
const ring: LegalityFacts = { name: 'Sol Ring', properties: { type: 'Artifact' }, legalities: { vintage: 'restricted', modern: 'banned' } };
const forest: LegalityFacts = { name: 'Forest', properties: { type: 'Basic Land — Forest' }, legalities: { modern: 'legal' } };
const nowhere: LegalityFacts = { name: 'Chaos Orb', legalities: {} };

const modernRules: FormatRules = toFormatRules({
  formatName: 'modern',
  allowedCounts: [{ max: '4', label: 'legal' }, { max: '1', label: 'restricted' }, { max: '0', label: 'banned' }],
  exceptions: [{ maxCopies: 'unlimited', conditions: [{ field: 'type', match: 'contains', value: 'basic land' }] }],
})!;

describe('toFormatRules', () => {
  it('reads counts and exceptions, with "unlimited" as -1', () => {
    expect(modernRules.allowedCounts).toEqual([{ label: 'legal', max: 4 }, { label: 'restricted', max: 1 }, { label: 'banned', max: 0 }]);
    expect(modernRules.exceptions[0].maxCopies).toBe(-1);
    expect(toFormatRules(undefined)).toBeUndefined();
  });
});

describe('cardMatchesCondition', () => {
  it.each([
    [{ field: 'name', match: 'equals', value: 'Lightning Bolt' }, true],
    [{ field: 'name', match: 'notEquals', value: 'Lightning Bolt' }, false],
    [{ field: 'text', match: 'contains', value: 'DEALS 3' }, true],
    [{ field: 'type', match: 'notContains', value: 'creature' }, true],
    [{ field: 'type', match: 'regex', value: '^inst' }, true],
    [{ field: 'type', match: 'regex', value: '(' }, false],
    [{ field: 'missing', match: 'equals', value: '' }, true],
  ])('%o → %s', (cond, expected) => {
    expect(cardMatchesCondition(bolt, cond)).toBe(expected);
  });
});

describe('cardLegality', () => {
  it('passes everything when the deck has no format', () => {
    expect(cardLegality('', nowhere, 99, modernRules)).toEqual({ status: 'legal' });
  });

  it('reports cards without legality data as unknown, not illegal', () => {
    expect(cardLegality('modern', undefined, 1, modernRules)).toEqual({ status: 'unknown' });
    expect(cardLegality('modern', { name: 'X' }, 1, modernRules)).toEqual({ status: 'unknown' });
  });

  describe('without format rules (desktop CardInfo::isLegalInFormat)', () => {
    it('accepts legal and restricted labels, regardless of count', () => {
      expect(cardLegality('vintage', bolt, 40, undefined)).toEqual({ status: 'legal' });
      expect(cardLegality('vintage', ring, 4, undefined)).toEqual({ status: 'legal' });
    });

    it('flags banned and unlisted cards', () => {
      expect(cardLegality('modern', ring, 1, undefined)).toEqual({ status: 'illegal', reason: 'banned' });
      expect(cardLegality('standard', bolt, 1, undefined)).toEqual({ status: 'illegal', reason: 'notLegal' });
      expect(cardLegality('MODERN', bolt, 1, undefined)).toEqual({ status: 'legal' });
    });
  });

  describe('with format rules (isCardQuantityLegalForFormat)', () => {
    it('limits copies by the label’s allowed count', () => {
      expect(cardLegality('modern', bolt, 4, modernRules)).toEqual({ status: 'legal' });
      expect(cardLegality('modern', bolt, 5, modernRules)).toEqual({ status: 'illegal', reason: 'tooMany', max: 4 });
    });

    it('treats a zero count as banned and an unlisted label as not legal', () => {
      expect(cardLegality('modern', ring, 1, modernRules)).toEqual({ status: 'illegal', reason: 'banned' });
      const custom = { ...bolt, legalities: { modern: 'special' } };
      expect(cardLegality('modern', custom, 1, modernRules)).toEqual({ status: 'illegal', reason: 'notLegal' });
      expect(cardLegality('modern', nowhere, 1, modernRules)).toEqual({ status: 'illegal', reason: 'notLegal' });
    });

    it('lets exceptions win over counts', () => {
      expect(cardLegality('modern', forest, 30, modernRules)).toEqual({ status: 'legal' });
    });

    it('honours an unlimited allowed count', () => {
      const rules = toFormatRules({ formatName: 'x', allowedCounts: [{ max: 'unlimited', label: 'legal' }] })!;
      expect(cardLegality('modern', bolt, 60, rules)).toEqual({ status: 'legal' });
    });

    it('keeps an unlimited count apart from a label the format does not list', () => {
      const rules = toFormatRules({ formatName: 'x', allowedCounts: [{ max: 'unlimited', label: 'legal' }] })!;
      expect(cardLegality('vintage', bolt, 60, rules)).toEqual({ status: 'legal' });
      expect(cardLegality('vintage', ring, 1, rules)).toEqual({ status: 'illegal', reason: 'notLegal' });
    });
  });
});

describe('deckLegality', () => {
  const card = (name: string, quantity = 1, category: DeckCard['category'] = 'main'): DeckCard => ({
    name, quantity, category, lookupSource: 'scryfall',
  });
  const facts = new Map<string, LegalityFacts | undefined>([
    ['Lightning Bolt', bolt], ['Sol Ring', ring], ['Forest', forest], ['Mystery', undefined],
  ]);

  it('checks each row against its own quantity and summarizes', () => {
    const result = deckLegality(
      [card('Lightning Bolt', 4), card('Lightning Bolt', 2, 'sideboard'), card('Sol Ring'), card('Mystery')],
      'modern',
      facts,
      modernRules,
    );
    expect(result.rows.map((r) => r.status)).toEqual(['legal', 'legal', 'illegal', 'unknown']);
    expect(result).toEqual(expect.objectContaining({ status: 'illegal', illegalCount: 1, unknownCount: 1 }));
  });

  it('is legal when every checked card is legal', () => {
    expect(deckLegality([card('Lightning Bolt'), card('Forest', 20)], 'modern', facts, undefined).status).toBe('legal');
  });

  it('is unavailable for a custom format, or when no card could be checked', () => {
    expect(deckLegality([card('Lightning Bolt')], 'Cube', facts, undefined).status).toBe('unavailable');
    expect(deckLegality([card('Mystery')], 'modern', facts, modernRules).status).toBe('unavailable');
  });

  it('checks a custom format that has imported rules or card labels', () => {
    const homebrew = new Map([['Lightning Bolt', { ...bolt, legalities: { pauperhome: 'legal' } }]]);
    expect(deckLegality([card('Lightning Bolt')], 'pauperhome', homebrew, undefined).status).toBe('legal');
  });

  it('has nothing to check in an empty deck', () => {
    expect(deckLegality([], 'modern', facts, modernRules).status).toBe('none');
  });

  it('has nothing to check without a format', () => {
    expect(deckLegality([card('Sol Ring')], '', facts, modernRules)).toEqual(
      expect.objectContaining({ status: 'none', illegalCount: 0 }),
    );
  });
});

describe('legalityFacts', () => {
  it('keeps what legality needs from a found lookup', () => {
    const lookup: LookupResult = {
      found: true, source: 'dexie', name: 'Lightning Bolt', printings: [],
      text: 't', properties: { type: 'Instant' }, legalities: { modern: 'legal' },
    };
    expect(legalityFacts(lookup)).toEqual({
      name: 'Lightning Bolt', text: 't', properties: { type: 'Instant' }, legalities: { modern: 'legal' },
    });
    expect(legalityFacts({ ...lookup, found: false })).toBeUndefined();
    expect(legalityFacts(undefined)).toBeUndefined();
  });
});
