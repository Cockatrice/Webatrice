import { renderHook } from '@testing-library/react';
import { useDeckEditorFrame } from './useDeckEditorFrame';
import { useKnownDeckData } from './useKnownDeckData';
import type { HydratedDeck } from '../types';

vi.mock('@app/store', () => ({ useAppSelector: () => true }));
vi.mock('./useKnownDeckData', () => ({ useKnownDeckData: vi.fn() }));

const deck: HydratedDeck = { name: 'Known name', format: 'modern', cards: [], meta: { v: 1, updatedAt: '' } };
const loading = { deck: null, loading: true, hydrating: false, readOnlyReason: null,
  totalMainboardCount: 0, totalSideboardCount: 0 };

beforeEach(() => {
  vi.mocked(useKnownDeckData).mockReturnValue({ deck, colors: 'UR', cardCount: 100, tags: ['Known tag'] });
});

it('uses metadata only for the pre-file frame and caps rows without losing the full header count', () => {
  const { result } = renderHook(() => useDeckEditorFrame(5, loading));
  expect(result.current.deck).toBe(deck);
  expect(result.current.totalMainboardCount).toBe(100);
  expect(result.current.placeholderRows).toHaveLength(12);
  expect(result.current.readOnlyReason).toBe('DeckEditor.hydrating');
  expect(result.current.readOnly).toBe(true);
});

it('leaves provisional rows and counts authoritative while preserving their read-only reason', () => {
  const provisional: HydratedDeck = { ...deck, name: 'Downloaded', cards: [
    { name: 'Bolt', category: 'main', quantity: 4, lookupSource: 'unknown' },
  ] };
  const { result } = renderHook(() => useDeckEditorFrame(5, { ...loading, deck: provisional, hydrating: true,
    readOnlyReason: 'DeckEditor.hydrating', totalMainboardCount: 4, totalSideboardCount: 2 }));
  expect(result.current.deck).toBe(provisional);
  expect(result.current.placeholderRows).toBeUndefined();
  expect(result.current.totalMainboardCount).toBe(4);
  expect(result.current.totalSideboardCount).toBe(2);
  expect(result.current.readOnlyReason).toBe('DeckEditor.hydrating');
  expect(result.current.readOnly).toBe(true);
});

it('uses hydrated data instead of cached metadata when editing becomes available', () => {
  const hydrated: HydratedDeck = { ...deck, tagsXml: '<tags><tag>Downloaded tag</tag></tags>', cards: [
    { name: 'Forest', category: 'main', quantity: 4, lookupSource: 'dexie', colors: ['G'], colorIdentity: ['G'] },
  ] };
  const { result } = renderHook(() => useDeckEditorFrame(5, { ...loading, loading: false,
    deck: hydrated, totalMainboardCount: 4 }));
  expect(result.current.deck).toBe(hydrated);
  expect(result.current.readOnly).toBe(false);
  expect(result.current.readOnlyReason).toBeNull();
  expect(result.current.totalMainboardCount).toBe(4);
  expect(result.current.colors).toBe('G');
  expect(result.current.tags).toEqual(['Downloaded tag']);
  expect(result.current.placeholderRows).toBeUndefined();
});
