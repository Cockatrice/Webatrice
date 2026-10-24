import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../../../__test-utils__';

import { CardRegistryContext, createCardRegistry, makeCardKey } from '../../../utils/CardRegistry/CardRegistryContext';
import { CardPreviewProvider, createCardPreviewStore } from '../CardPreviewContext';
import { useCardFocus, type CardFocusOptions } from './useCardFocus';

type Card = { id: string; name: string; faceDown?: boolean };
const CARDS: Card[] = [{ id: '1', name: 'Forest' }, { id: '2', name: 'Bears' }, { id: '3', name: 'Hidden', faceDown: true }];

type ZoneProps = Partial<CardFocusOptions<Card>> & { initial?: string[] };

function Zone({ initial = [], ...props }: ZoneProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(initial));
  const { cardProps } = useCardFocus<Card>({
    zone: 'table',
    cards: CARDS,
    orientation: 'horizontal',
    ownerOf: () => 4,
    labelOf: (c) => `${c.name} label`,
    previewOf: (c) => (c.faceDown ? null : { name: c.name }),
    selectedIds: selected,
    onSelectIds: setSelected,
    onOpenMenu: vi.fn(),
    ...props,
  });
  return (
    <>
      <button type="button">before</button>
      <div role="listbox" aria-label="zone">
        {CARDS.map((c) => <div key={c.id} data-testid={c.id} {...cardProps(c)} />)}
      </div>
      <button type="button">after</button>
    </>
  );
}

function renderZone(props: ZoneProps = {}) {
  const preview = createCardPreviewStore();
  const registry = createCardRegistry();
  vi.spyOn(preview, 'setFocusedCard');
  vi.spyOn(preview, 'openBigPreview');
  vi.spyOn(preview, 'closeBigPreview');
  renderWithProviders(
    <CardRegistryContext.Provider value={registry}>
      <CardPreviewProvider store={preview}>
        <Zone {...props} />
      </CardPreviewProvider>
    </CardRegistryContext.Provider>,
  );
  return { preview, registry };
}

const card = (id: string) => screen.getByTestId(id);
const focus = (id: string) => act(() => card(id).focus());

describe('useCardFocus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the move dialog on the game.moveCardDialog key (M), not on Ctrl+M', () => {
    const onMove = vi.fn();
    renderZone({ onMove });
    focus('2');
    fireEvent.keyDown(card('2'), { key: 'm', code: 'KeyM', ctrlKey: true });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.keyDown(card('2'), { key: 'm', code: 'KeyM' });
    expect(onMove).toHaveBeenCalledWith(CARDS[1]);
  });

  it('makes the cards named options with one tab stop, on the first selected card', () => {
    renderZone({ initial: ['2'] });
    expect(screen.getByRole('option', { name: 'Bears label' })).toHaveAttribute('aria-selected', 'true');
    expect(CARDS.map((c) => card(c.id).tabIndex)).toEqual([-1, 0, -1]);
  });

  it('moves focus and the selection with the arrows, and extends it with Shift', () => {
    renderZone();
    focus('1');
    fireEvent.keyDown(card('1'), { key: 'ArrowRight' });
    expect(card('2')).toHaveFocus();
    expect(card('2')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(card('2'), { key: 'ArrowRight', shiftKey: true });
    expect(card('3')).toHaveFocus();
    expect(CARDS.map((c) => card(c.id).getAttribute('aria-selected'))).toEqual(['false', 'true', 'true']);
    expect(card('3').tabIndex).toBe(0);
  });

  it('toggles the focused card in or out of the selection with Space, keeping the others', () => {
    renderZone({ initial: ['1'] });
    focus('2');
    fireEvent.keyDown(card('2'), { key: ' ' });
    expect(['1', '2', '3'].map((id) => card(id).getAttribute('aria-selected'))).toEqual(['true', 'true', 'false']);
    fireEvent.keyDown(card('2'), { key: ' ' });
    expect(['1', '2', '3'].map((id) => card(id).getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
    fireEvent.keyDown(card('1'), { key: ' ' });
    expect(['1', '2', '3'].map((id) => card(id).getAttribute('aria-selected'))).toEqual(['false', 'false', 'false']);
  });

  it('moves focus alone with Ctrl and an arrow, so Space builds a selection with gaps', () => {
    renderZone();
    focus('1');
    fireEvent.keyDown(card('1'), { key: ' ' });
    fireEvent.keyDown(card('1'), { key: 'ArrowRight', ctrlKey: true });
    expect(card('2')).toHaveFocus();
    expect(card('2')).toHaveAttribute('aria-selected', 'false');
    fireEvent.keyDown(card('2'), { key: 'ArrowRight', ctrlKey: true });
    fireEvent.keyDown(card('3'), { key: ' ' });
    expect(['1', '2', '3'].map((id) => card(id).getAttribute('aria-selected'))).toEqual(['true', 'false', 'true']);
    fireEvent.keyDown(card('3'), { key: 'ArrowLeft' });
    expect(['1', '2', '3'].map((id) => card(id).getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  });

  it('plays a card on Enter, but leaves Shift+Enter to the chat shortcut', () => {
    const onActivate = vi.fn();
    renderZone({ onActivate });
    focus('2');
    fireEvent.keyDown(card('2'), { key: 'Enter', shiftKey: true });
    expect(onActivate).not.toHaveBeenCalled();
    fireEvent.keyDown(card('2'), { key: 'Enter' });
    expect(onActivate).toHaveBeenCalledWith(CARDS[1], card('2'));
  });

  it('opens the card menu under the card on Shift+F10 and the Menu key', () => {
    const onOpenMenu = vi.fn();
    renderZone({ onOpenMenu });
    focus('1');
    expect(fireEvent.keyDown(card('1'), { key: 'F10', shiftKey: true })).toBe(false);
    fireEvent.keyDown(card('1'), { key: 'ContextMenu' });
    expect(onOpenMenu).toHaveBeenCalledTimes(2);
    expect(onOpenMenu.mock.calls[0][0]).toBe(CARDS[0]);
  });

  it('leaves the zone with F6 and Shift+F6, to the next and previous tab stop', () => {
    renderZone();
    focus('1');
    fireEvent.keyDown(card('1'), { key: 'F6' });
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    focus('1');
    fireEvent.keyDown(card('1'), { key: 'F6', shiftKey: true });
    expect(screen.getByRole('button', { name: 'before' })).toHaveFocus();
  });

  it('previews a card on keyboard focus only, and never a face-down one', () => {
    const { preview } = renderZone();
    focus('2');
    expect(preview.setFocusedCard).toHaveBeenLastCalledWith({ name: 'Bears' });
    act(() => card('2').blur());
    expect(preview.setFocusedCard).toHaveBeenLastCalledWith(null);

    vi.mocked(preview.setFocusedCard).mockClear();
    fireEvent.pointerDown(card('1'));
    focus('1');
    expect(preview.setFocusedCard).not.toHaveBeenCalled();

    focus('3');
    expect(preview.setFocusedCard).toHaveBeenLastCalledWith(null);
  });

  it('zooms the focused card while Z is held', () => {
    const { preview } = renderZone();
    focus('2');
    fireEvent.keyDown(card('2'), { key: 'z' });
    expect(preview.openBigPreview).toHaveBeenCalledWith(
      { name: 'Bears' },
      expect.objectContaining({ left: expect.any(Number), bottom: expect.any(Number) }),
    );
    fireEvent.keyUp(card('2'), { key: 'z' });
    expect(preview.closeBigPreview).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card('3'), { key: 'z' });
    expect(preview.openBigPreview).toHaveBeenCalledTimes(1);
  });

  it('registers each card with the card registry under its owner and zone', () => {
    const { registry } = renderZone();
    expect(registry.get(makeCardKey(4, 'table', 2))).toBe(card('2'));
  });
});
