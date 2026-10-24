import { act, renderHook } from '@testing-library/react';

import { inspectedRow, type InspectedCard } from '../components/editor/editorSelection';
import type { DeckCard } from '../types';
import { PREVIEW_LEAVE_DELAY_MS, useInspectorPreview } from './useInspectorPreview';

const card = (name: string, category: DeckCard['category'] = 'main'): DeckCard =>
  ({ name, quantity: 1, category, lookupSource: 'scryfall' });

const cards = [card('Sol Ring'), card('Ponder'), card('Duress', 'sideboard')];

function renderPreview(selected: InspectedCard | null = inspectedRow(cards[0])) {
  return renderHook(({ selection }) => useInspectorPreview(cards, selection), { initialProps: { selection: selected } });
}

describe('useInspectorPreview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('previews the selected card until another card is hovered', () => {
    const { result } = renderPreview();
    expect(result.current.card?.name).toBe('Sol Ring');
    expect(result.current.index).toBe(0);

    act(() => result.current.enter(inspectedRow(cards[2])));
    expect(result.current.card?.name).toBe('Duress');
    expect(result.current.index).toBe(2);
  });

  it('returns to the selected card shortly after the pointer leaves', () => {
    const { result } = renderPreview();
    act(() => result.current.enter(inspectedRow(cards[1])));
    act(() => result.current.leave());
    expect(result.current.card?.name).toBe('Ponder');
    act(() => vi.advanceTimersByTime(PREVIEW_LEAVE_DELAY_MS));
    expect(result.current.card?.name).toBe('Sol Ring');
  });

  it('moves straight from one hovered row to the next without flashing the selection', () => {
    const { result } = renderPreview();
    act(() => result.current.enter(inspectedRow(cards[1])));
    act(() => {
      result.current.leave();
      result.current.enter(inspectedRow(cards[2]));
    });
    act(() => vi.advanceTimersByTime(PREVIEW_LEAVE_DELAY_MS * 2));
    expect(result.current.card?.name).toBe('Duress');
  });

  it('drops the hover at once when asked, so the inspector acts on the selection', () => {
    const { result } = renderPreview();
    act(() => result.current.enter(inspectedRow(cards[1])));
    act(() => result.current.clear());
    expect(result.current.card?.name).toBe('Sol Ring');
    expect(result.current.hovered).toBeNull();
  });

  it('follows a new selection when nothing is hovered', () => {
    const { result, rerender } = renderPreview(null);
    expect(result.current.card).toBeNull();
    rerender({ selection: inspectedRow(cards[1]) });
    expect(result.current.card?.name).toBe('Ponder');
  });
});
