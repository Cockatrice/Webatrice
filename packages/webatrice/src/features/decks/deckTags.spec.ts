import {
  DEFAULT_DECK_TAGS,
  bannerCandidates,
  readDeckTags,
  tagSuggestions,
  validateNewTag,
  writeDeckTags,
} from './deckTags';
import type { DeckCard } from './types';

describe('readDeckTags', () => {
  it('reads the <tag> children in order and ignores everything else', () => {
    expect(readDeckTags('<tags><tag>Aggro</tag><note>keep</note><tag>Burn</tag><tag/></tags>')).toEqual(['Aggro', 'Burn']);
  });

  it('returns no tags for a missing, empty or malformed element', () => {
    expect(readDeckTags(undefined)).toEqual([]);
    expect(readDeckTags('<tags/>')).toEqual([]);
    expect(readDeckTags('<tags><tag>')).toEqual([]);
    expect(readDeckTags('<other/>')).toEqual([]);
  });
});

describe('writeDeckTags', () => {
  it('writes a fresh <tags> element', () => {
    expect(writeDeckTags(undefined, ['Aggro', 'R&D <1>'])).toBe('<tags><tag>Aggro</tag><tag>R&amp;D &lt;1&gt;</tag></tags>');
  });

  it('replaces only the <tag> children, keeping unknown children', () => {
    const next = writeDeckTags('<tags><tag>Old</tag><note a="1">keep</note></tags>', ['New']);
    expect(next).toBe('<tags><note a="1">keep</note><tag>New</tag></tags>');
    expect(readDeckTags(next)).toEqual(['New']);
  });

  it('clears the element when nothing is left, but not when unknown children remain', () => {
    expect(writeDeckTags('<tags><tag>Old</tag></tags>', [])).toBeUndefined();
    expect(writeDeckTags('<tags><note/></tags>', [])).toBe('<tags><note/></tags>');
  });
});

describe('validateNewTag', () => {
  it('rejects empty and repeated tags', () => {
    expect(validateNewTag('  ', [])).toBe('empty');
    expect(validateNewTag(' Aggro ', ['Aggro'])).toBe('duplicate');
    expect(validateNewTag('Burn', ['Aggro'])).toBe('ok');
  });
});

describe('tagSuggestions', () => {
  it('offers the defaults then other known tags, without the active ones or repeats', () => {
    const suggestions = tagSuggestions([DEFAULT_DECK_TAGS[0]], ['Mine', DEFAULT_DECK_TAGS[1], 'Mine']);
    expect(suggestions[0]).toBe(DEFAULT_DECK_TAGS[1]);
    expect(suggestions).not.toContain(DEFAULT_DECK_TAGS[0]);
    expect(suggestions.filter((t) => t === 'Mine')).toHaveLength(1);
    expect(suggestions[suggestions.length - 1]).toBe('Mine');
  });
});

describe('bannerCandidates', () => {
  const card = (name: string, scryfallId?: string): DeckCard => ({
    name, quantity: 1, category: 'main', lookupSource: 'scryfall', scryfallId,
  });

  it('lists each distinct card and printing once, sorted by name', () => {
    expect(bannerCandidates([card('Shock', 'b'), card('Bolt', 'a'), card('Shock', 'b'), card('Shock', 'c')])).toEqual([
      { name: 'Bolt', providerId: 'a' },
      { name: 'Shock', providerId: 'b' },
      { name: 'Shock', providerId: 'c' },
    ]);
  });
});
