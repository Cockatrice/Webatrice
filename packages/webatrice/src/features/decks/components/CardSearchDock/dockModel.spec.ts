import { EMPTY_FILTERS } from '../../cardSearchQuery';
import type { DeckCard } from '../../types';
import {
  artCropUrl,
  clampHighlight,
  deckQuantities,
  dockKeyZone,
  gameChangerNote,
  initialDockFilters,
  isImeComposition,
  isScryfallPageUrl,
  moveHighlight,
  shouldSearch,
  shownColours,
  toggleDockColour,
} from './dockModel';

const card = (name: string, quantity = 1, category: DeckCard['category'] = 'main'): DeckCard => ({
  name, quantity, category, lookupSource: 'scryfall',
});

function key(init: KeyboardEventInit & { code: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('initialDockFilters', () => {
  it('searches within the commander and the deck format when both are known', () => {
    expect(initialDockFilters(['W', 'U'], 'commander')).toMatchObject({ colorMode: 'withinIdentity', legalOnly: true });
  });

  it('falls back to plain colour matching without an identity and drops legality for unknown formats', () => {
    expect(initialDockFilters([], 'house rules')).toMatchObject({ colorMode: 'includes', legalOnly: false });
    expect(initialDockFilters(undefined, undefined)).toMatchObject({ colorMode: 'includes', legalOnly: false });
  });
});

describe('dock colours', () => {
  it('shows the identity while searching within it', () => {
    const f = { ...EMPTY_FILTERS, colorMode: 'withinIdentity' as const };
    expect(shownColours(f, ['W', 'G'])).toEqual(['W', 'G']);
    expect(shownColours({ ...EMPTY_FILTERS, colors: ['R'] }, ['W', 'G'])).toEqual(['R']);
  });

  it('turns a toggle inside the identity into an at-most search starting from the identity', () => {
    const f = { ...EMPTY_FILTERS, colorMode: 'withinIdentity' as const };
    expect(toggleDockColour(f, 'G', ['W', 'U', 'G'])).toMatchObject({ colorMode: 'atMost', colors: ['W', 'U'] });
    expect(toggleDockColour(f, 'R', ['W'])).toMatchObject({ colorMode: 'atMost', colors: ['W', 'R'] });
  });

  it('toggles plain colours otherwise', () => {
    expect(toggleDockColour({ ...EMPTY_FILTERS, colors: ['R'] }, 'R', undefined).colors).toEqual([]);
  });
});

describe('shouldSearch', () => {
  it('waits for text or a narrowing filter, not the default scope alone', () => {
    const scoped = initialDockFilters(['W'], 'commander');
    expect(shouldSearch('  ', scoped)).toBe(false);
    expect(shouldSearch('bolt', scoped)).toBe(true);
    expect(shouldSearch('', { ...scoped, types: ['Creature'] })).toBe(true);
  });
});

describe('highlight movement', () => {
  it('enters the list from either end and stops at the edges', () => {
    expect(moveHighlight(-1, 1, 3)).toBe(0);
    expect(moveHighlight(-1, -1, 3)).toBe(2);
    expect(moveHighlight(2, 1, 3)).toBe(2);
    expect(moveHighlight(0, -1, 3)).toBe(0);
    expect(moveHighlight(0, 1, 0)).toBe(-1);
  });

  it('clamps a remembered highlight to the current results', () => {
    expect(clampHighlight(5, 3)).toBe(2);
    expect(clampHighlight(0, 0)).toBe(-1);
  });
});

describe('dockKeyZone', () => {
  const bindings = { main: ['Enter', 'NumpadEnter'], side: ['Ctrl+Enter'] };

  it('maps the bound keys to the deck or the sideboard', () => {
    expect(dockKeyZone(key({ code: 'Enter', key: 'Enter' }), bindings)).toBe('main');
    expect(dockKeyZone(key({ code: 'NumpadEnter', key: 'Enter' }), bindings)).toBe('main');
    expect(dockKeyZone(key({ code: 'Enter', key: 'Enter', ctrlKey: true }), bindings)).toBe('side');
    expect(dockKeyZone(key({ code: 'KeyA', key: 'a' }), bindings)).toBeNull();
  });

  it('follows rebinding and unbinding', () => {
    expect(dockKeyZone(key({ code: 'Enter', key: 'Enter' }), { main: [], side: [] })).toBeNull();
    expect(dockKeyZone(key({ code: 'KeyS', key: 's', altKey: true }), { main: [], side: ['Alt+KeyS'] })).toBe('side');
  });
});

describe('isImeComposition', () => {
  it('recognises composition by flag or by the legacy 229 key code', () => {
    expect(isImeComposition(key({ code: 'Enter', key: 'Enter', isComposing: true }))).toBe(true);
    expect(isImeComposition(new KeyboardEvent('keydown', { key: 'Process', keyCode: 229 } as KeyboardEventInit))).toBe(true);
    expect(isImeComposition(key({ code: 'Enter', key: 'Enter' }))).toBe(false);
  });
});

describe('deckQuantities', () => {
  it('sums copies across zones and printings', () => {
    expect(deckQuantities([card('Sol Ring'), card('Island', 3), card('Island', 2, 'sideboard')])).toEqual(
      new Map([['Sol Ring', 1], ['Island', 5]]),
    );
  });
});

describe('gameChangerNote', () => {
  const gameChangers = new Set(['Rhystic Study', 'Cyclonic Rift', 'Orcish Bowmasters', 'Smothering Tithe']);
  const base = { gameChangers, format: 'commander' };

  it('says nothing without the list, outside Commander, or for ordinary cards', () => {
    expect(gameChangerNote({ ...base, cardName: 'Orcish Bowmasters', gameChangers: null, deckCards: [] })).toEqual({ kind: 'none' });
    expect(gameChangerNote({ ...base, cardName: 'Orcish Bowmasters', format: 'modern', deckCards: [] })).toEqual({ kind: 'none' });
    expect(gameChangerNote({ ...base, cardName: 'Llanowar Elves', deckCards: [] })).toEqual({ kind: 'none' });
  });

  it('counts the main deck’s distinct Game Changers plus this one against Bracket 3', () => {
    const deckCards = [card('Rhystic Study'), card('Cyclonic Rift'), card('Smothering Tithe', 1, 'sideboard')];
    expect(gameChangerNote({ ...base, cardName: 'Orcish Bowmasters', deckCards })).toEqual({
      kind: 'count', count: 3, limit: 3, over: false,
    });
    expect(gameChangerNote({ ...base, cardName: 'Smothering Tithe', deckCards: [...deckCards, card('Orcish Bowmasters')] })).toEqual({
      kind: 'count', count: 4, limit: 3, over: true,
    });
  });

  it('does not count a card already in the deck twice', () => {
    expect(gameChangerNote({ ...base, cardName: 'Rhystic Study', deckCards: [card('Rhystic Study')] })).toEqual({ kind: 'present' });
    expect(gameChangerNote({ ...base, cardName: 'Rhystic Study', deckCards: undefined })).toEqual({ kind: 'present' });
  });
});

describe('urls', () => {
  it('asks Scryfall for the art crop of a printing image', () => {
    expect(artCropUrl('https://cards.scryfall.io/normal/front/a/b/ab.jpg?1')).toBe('https://cards.scryfall.io/art_crop/front/a/b/ab.jpg?1');
    expect(artCropUrl('https://example.org/card.jpg')).toBe('https://example.org/card.jpg');
  });

  it('only follows Scryfall search pages', () => {
    expect(isScryfallPageUrl('https://api.scryfall.com/cards/search?q=x&page=2')).toBe(true);
    expect(isScryfallPageUrl('https://evil.example/cards/search?q=x')).toBe(false);
    expect(isScryfallPageUrl(null)).toBe(false);
  });
});
