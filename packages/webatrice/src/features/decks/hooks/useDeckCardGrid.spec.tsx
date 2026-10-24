import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import type { DeckCategory } from '@app/types';

import { renderWithProviders } from '../../../__test-utils__';
import type { DeckCard } from '../types';
import { useDeckCardGrid } from './useDeckCardGrid';

const card = (name: string, quantity = 1, extra: Partial<DeckCard> = {}): DeckCard =>
  ({ name, quantity, category: 'main', lookupSource: 'scryfall', ...extra });

function DeckList({ initial, onLastRowRemoved, readOnly = false }: {
  initial: DeckCard[]; onLastRowRemoved?: () => void; readOnly?: boolean;
}) {
  const [cards, setCards] = useState(initial);
  const order = [
    ...cards.map((c, i) => (c.category === 'main' ? i : -1)),
    ...cards.map((c, i) => (c.category === 'sideboard' ? i : -1)),
  ].filter((i) => i >= 0);
  const grid = useDeckCardGrid({
    readOnly,
    cards,
    order,
    onInc: (index, delta) => setCards((prev) => prev
      .map((c, i) => (i === index ? { ...c, quantity: c.quantity + delta } : c))
      .filter((c) => c.quantity > 0)),
    onDelete: (index) => setCards((prev) => prev.filter((_, i) => i !== index)),
    onSetCategory: (index: number, category: DeckCategory) =>
      setCards((prev) => prev.map((c, i) => (i === index ? { ...c, category } : c))),
    onLastRowRemoved,
  });
  return (
    <>
      <input aria-label="Search" />
      <div role="grid" aria-label="Deck">
        {order.map((i) => (
          <div key={`${cards[i].category}:${cards[i].name}`} role="row" aria-label={cards[i].name} {...grid.getDeckRowProps(i)}>
            <span role="gridcell">{`${cards[i].quantity} ${cards[i].category}`}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function renderList(cards: DeckCard[], onLastRowRemoved?: () => void) {
  renderWithProviders(
    <ShortcutProvider><DeckList initial={cards} onLastRowRemoved={onLastRowRemoved} /></ShortcutProvider>,
    { route: '/deck/1' },
  );
  return {
    user: userEvent.setup(),
    row: (name: string) => screen.getByRole('row', { name }),
  };
}

describe('useDeckCardGrid', () => {
  it('keeps one tab stop and moves it with the arrows', async () => {
    const { user, row } = renderList([card('Bolt'), card('Shock'), card('Duress', 1, { category: 'sideboard' })]);
    await user.click(screen.getByRole('textbox', { name: 'Search' }));
    await user.tab();
    expect(row('Bolt')).toHaveFocus();
    expect(row('Shock')).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(row('Duress')).toHaveFocus();
    expect(row('Duress')).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(row('Bolt')).toHaveFocus();
  });

  it('adds a copy with Enter, Shift+→ and Ctrl+Alt+=, and removes one with Shift+← and Ctrl+Alt+−, like desktop', async () => {
    const { user, row } = renderList([card('Bolt', 2)]);
    row('Bolt').focus();

    await user.keyboard('{Enter}');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    await user.keyboard('{Control>}{Alt>}[Equal]{/Alt}{/Control}');
    expect(row('Bolt')).toHaveTextContent('5 main');

    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    await user.keyboard('{Control>}{Alt>}[Minus]{/Alt}{/Control}');
    expect(row('Bolt')).toHaveTextContent('3 main');
  });

  it('runs the rebindable + and − shortcuts on the focused row only', async () => {
    const { user, row } = renderList([card('Bolt', 2), card('Shock', 2)]);
    await user.click(screen.getByRole('textbox', { name: 'Search' }));
    await user.keyboard('[Equal]');
    expect(row('Bolt')).toHaveTextContent('2 main');

    row('Shock').focus();
    await user.keyboard('[Equal]');
    expect(row('Shock')).toHaveTextContent('3 main');
    await user.keyboard('[Minus]');
    await user.keyboard('[Minus]');
    expect(row('Shock')).toHaveTextContent('1 main');
    expect(row('Bolt')).toHaveTextContent('2 main');
  });

  it('adds a copy on desktop\'s + (Shift+= on US layouts)', async () => {
    const { user, row } = renderList([card('Bolt', 2)]);
    row('Bolt').focus();
    await user.keyboard('{Shift>}[Equal]{/Shift}');
    expect(row('Bolt')).toHaveTextContent('3 main');
  });

  it('removes the row with Delete and hands focus to the next one', async () => {
    const { user, row } = renderList([card('Bolt'), card('Shock'), card('Opt')]);
    row('Shock').focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('row', { name: 'Shock' })).toBeNull();
    expect(row('Opt')).toHaveFocus();

    await user.keyboard('{Delete}');
    expect(row('Bolt')).toHaveFocus();
  });

  it('hands focus out of the list when its last row is removed', async () => {
    const onLastRowRemoved = vi.fn(() => screen.getByRole('textbox', { name: 'Search' }).focus());
    const { user, row } = renderList([card('Bolt')], onLastRowRemoved);
    row('Bolt').focus();
    await user.keyboard('{Delete}');
    expect(onLastRowRemoved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
  });

  it('hands focus on when the last copy is removed with −', async () => {
    const { user, row } = renderList([card('Bolt'), card('Shock')]);
    row('Bolt').focus();
    await user.keyboard('[Minus]');
    expect(screen.queryByRole('row', { name: 'Bolt' })).toBeNull();
    expect(row('Shock')).toHaveFocus();
  });

  it('swaps a row between main and sideboard with Shift+S, keeping focus on it', async () => {
    const { user, row } = renderList([card('Bolt'), card('Shock')]);
    row('Bolt').focus();
    await user.keyboard('{Shift>}S{/Shift}');
    expect(row('Bolt')).toHaveTextContent('1 sideboard');
    expect(row('Bolt')).toHaveFocus();

    await user.keyboard('{Shift>}S{/Shift}');
    expect(row('Bolt')).toHaveTextContent('1 main');
    expect(row('Bolt')).toHaveFocus();
  });

  it('matches Shift+S by the typed letter, so other layouts swap on their own S key', () => {
    const { row } = renderList([card('Bolt')]);
    fireEvent.keyDown(row('Bolt'), { key: 'O', code: 'KeyS', shiftKey: true });
    expect(row('Bolt')).toHaveTextContent('1 main');
    fireEvent.keyDown(row('Bolt'), { key: 'S', code: 'Semicolon', shiftKey: true });
    expect(row('Bolt')).toHaveTextContent('1 sideboard');
  });

  it('never sideboards the commander', async () => {
    const { user, row } = renderList([card('Atraxa', 1, { isCommander: true })]);
    row('Atraxa').focus();
    await user.keyboard('{Shift>}S{/Shift}');
    expect(row('Atraxa')).toHaveTextContent('1 main');
  });
});

it('allows row navigation while blocking keyboard mutations in a provisional deck', async () => {
  const user = userEvent.setup();
  renderWithProviders(<ShortcutProvider><DeckList initial={[card('Bolt', 2), card('Shock')]} readOnly /></ShortcutProvider>,
    { route: '/deck/1' });
  const bolt = screen.getByRole('row', { name: 'Bolt' });
  bolt.focus();
  await user.keyboard('{Enter}{Shift>}{ArrowRight}{ArrowLeft}s{/Shift}{Delete}{Control>}{Alt>}={/Alt}{/Control}');
  expect(bolt).toHaveTextContent('2 main');
  expect(screen.getAllByRole('row')).toHaveLength(2);
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('row', { name: 'Shock' })).toHaveFocus();
});
