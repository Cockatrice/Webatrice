import { renderHook, waitFor } from '@testing-library/react';
import type { LookupResult } from '@app/services';

import type { BattlefieldCardViewModel, SeatDeckCard } from './playerBoard.types';
import { seatCardMetaFromLookup, useSeatCardMetadata, type UseSeatCardMetadataArgs } from './useSeatCardMetadata';

const catalog = vi.hoisted(() => ({
  lookupCard: vi.fn(),
  lookupCards: vi.fn(),
  preferences: { cardOverrides: {} as Record<string, string> },
}));

vi.mock('@app/hooks', () => ({
  useCardDataPreferences: () => ({ value: catalog.preferences }),
}));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  ...catalog,
}));

const record = (name: string, extra: Partial<LookupResult> = {}): LookupResult => ({
  found: true,
  source: 'scryfall',
  name,
  printings: [{ scryfallId: `${name}-id` }],
  ...extra,
});

const BEAR = record('Bear', { typeLine: 'Creature — Bear', power: '2', toughness: '2', cmc: 2, colors: ['G'] });
const MAKER = record('Maker', { typeLine: 'Creature', related: [{ name: 'Goblin', component: 'token', origin: 'scryfall' }] });
const DFC = record('Delver', {
  layout: 'transform',
  faces: [{ name: 'Delver', imageUri: 'front.jpg' }, { name: 'Insectile Aberration', imageUri: 'back.jpg' }],
});
const RECORDS: Record<string, LookupResult> = { Bear: BEAR, Maker: MAKER, Delver: DFC };

const battlefieldCard = (id: number, name: string): BattlefieldCardViewModel => ({
  id: String(id),
  name,
  scryfallId: '',
  slot: { row: 0, col: id },
  subSlot: 0,
  tapped: false,
});

const NO_DECK: readonly SeatDeckCard[] = [];
const NO_BATTLEFIELD: readonly BattlefieldCardViewModel[] = [];

function renderMetadata(args: Partial<UseSeatCardMetadataArgs> = {}) {
  return renderHook(() => useSeatCardMetadata({
    isSelf: true,
    deckCards: NO_DECK,
    battlefieldCards: NO_BATTLEFIELD,
    ...args,
  }));
}

beforeEach(() => {
  catalog.preferences = { cardOverrides: {} };
  catalog.lookupCard.mockImplementation(async (name: string) => RECORDS[name] ?? record(name));
  catalog.lookupCards.mockImplementation(async (names: string[]) =>
    new Map(names.filter((n) => n !== 'Unknown token').map((n) => [n, record(n)])));
});

describe('seatCardMetaFromLookup', () => {
  it('uses the pinned printing and does not substitute for a stale pin', () => {
    expect(seatCardMetaFromLookup(record('Pinned', {
      pinnedPrintingId: 'second',
      printings: [{ scryfallId: 'first' }, { scryfallId: 'second' }],
    })).scryfallId).toBe('second');
    expect(seatCardMetaFromLookup(record('Stale', {
      pinnedPrintingId: 'missing',
      printings: [{ scryfallId: 'first' }],
    })).scryfallId).toBeUndefined();
  });

  it('keeps the catalog fields the seat reads and joins the printed P/T', () => {
    expect(seatCardMetaFromLookup(BEAR)).toEqual({
      typeLine: 'Creature — Bear',
      pt: '2/2',
      manaCost: undefined,
      cmc: 2,
      colors: ['G'],
      power: '2',
      toughness: '2',
      related: undefined,
      layout: undefined,
      faces: undefined,
      scryfallId: 'Bear-id',
    });
    expect(seatCardMetaFromLookup(record('Shock'))).toMatchObject({ typeLine: '', pt: undefined });
    expect(seatCardMetaFromLookup({ ...BEAR, tableRow: 0 })).toMatchObject({ tableRow: 0 });
  });
});

describe('useSeatCardMetadata', () => {
  it('looks up the own deck list once per name, and none for another seat', async () => {
    const deckCards: SeatDeckCard[] = [
      { name: 'Bear', scryfallId: 'b', sideboard: false, commander: false },
      { name: 'Bear', scryfallId: 'b', sideboard: false, commander: false },
      { name: 'Maker', scryfallId: '', sideboard: true, commander: false },
    ];
    const { result } = renderMetadata({ deckCards });
    await waitFor(() => expect(result.current.cardMetaByName.get('Maker')?.typeLine).toBe('Creature'));
    expect(catalog.lookupCard.mock.calls.map(([name]) => name)).toEqual(['Bear', 'Maker']);
    expect(result.current.cardMetaByName.get('Bear')?.pt).toBe('2/2');

    catalog.lookupCard.mockClear();
    renderMetadata({ isSelf: false, deckCards });
    expect(catalog.lookupCard).not.toHaveBeenCalled();
  });

  it('preloads the own main-deck images, by name when a row has no printing', () => {
    const images: string[] = [];
    const ImageSpy = vi.spyOn(window, 'Image').mockImplementation(function image(this: HTMLImageElement) {
      Object.defineProperty(this, 'src', { set: (src: string) => images.push(src) });
      return this;
    } as unknown as () => HTMLImageElement);
    renderMetadata({
      deckCards: [
        { name: 'Bear', scryfallId: 'b', sideboard: false, commander: false },
        { name: 'Maker', scryfallId: '', sideboard: false, commander: false },
        { name: 'Delver', scryfallId: 'd', sideboard: true, commander: false },
      ],
    });
    expect(images).toEqual([
      'https://api.scryfall.com/cards/b?format=image&version=large',
      'https://api.scryfall.com/cards/named?exact=Maker&format=image&version=large',
    ]);
    ImageSpy.mockRestore();
  });

  it('enriches battlefield cards on any seat, then the tokens they relate to', async () => {
    const { result } = renderMetadata({ isSelf: false, battlefieldCards: [battlefieldCard(1, 'Maker'), battlefieldCard(2, 'Bear')] });
    await waitFor(() => expect(result.current.tokenMetaByName.get('Goblin')?.found).toBe(true));
    expect(catalog.lookupCards).toHaveBeenCalledWith(['Goblin']);
    expect(result.current.describeCard('Bear')).toEqual({
      name: 'Bear',
      typeLine: 'Creature — Bear',
      cmc: 2,
      colors: ['G'],
      power: '2',
      toughness: '2',
    });
  });

  it('uses the current exact-name pin for cached related-token metadata', async () => {
    catalog.preferences = { cardOverrides: { Goblin: 'pin-a' } };
    const { result, rerender } = renderMetadata({ battlefieldCards: [battlefieldCard(1, 'Maker')] });
    await waitFor(() => expect(result.current.tokenMetaByName.get('Goblin')?.pinnedPrintingId).toBe('pin-a'));
    catalog.preferences = { cardOverrides: { Goblin: 'pin-b' } };
    rerender();
    expect(result.current.tokenMetaByName.get('Goblin')?.pinnedPrintingId).toBe('pin-b');
    expect(catalog.lookupCards).toHaveBeenCalledOnce();
  });

  it('caches a token the catalog does not know as unknown, so it is not asked again', async () => {
    const lonely = record('Lonely', { related: [{ name: 'Unknown token', origin: 'scryfall' }] });
    catalog.lookupCard.mockImplementation(async () => lonely);
    const { result } = renderMetadata({ battlefieldCards: [battlefieldCard(1, 'Lonely')] });
    await waitFor(() => expect(result.current.tokenMetaByName.get('Unknown token')).toEqual({
      found: false,
      source: 'unknown',
      name: 'Unknown token',
      printings: [],
    }));
  });

  it('resolves the face image of a transformed card, and nothing for a single-faced one', async () => {
    const { result } = renderMetadata({ battlefieldCards: [battlefieldCard(1, 'Delver'), battlefieldCard(2, 'Bear')] });
    await waitFor(() => expect(result.current.cardMetaByName.has('Delver')).toBe(true));
    expect(result.current.resolveFaceImageUri('Insectile Aberration')).toBeUndefined();
    expect(result.current.resolveFaceImageUri('Delver')).toBe('front.jpg');
    expect(result.current.resolveFaceImageUri('Bear')).toBeUndefined();
  });
});
