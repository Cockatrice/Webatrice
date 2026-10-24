import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../../../__test-utils__';
import type { DeckCard } from '../../types';
import { DeckCardRow, type DeckCardRowProps } from './DeckCardRow';

const bolt: DeckCard = { name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall', manaCost: '{R}' };

function renderRow(overrides: Partial<DeckCardRowProps> = {}) {
  const props: DeckCardRowProps = {
    card: bolt,
    onSelect: vi.fn(),
    onInc: vi.fn(),
    onDelete: vi.fn(),
    onSetCategory: vi.fn(),
    onSetCommander: vi.fn(),
    onChangePrinting: vi.fn(),
    onShowDetails: vi.fn(),
    isMtg: true,
    isCommander: false,
    ...overrides,
  };
  renderWithProviders(<DeckCardRow {...props} />);
  return props;
}

describe('DeckCardRow', () => {
  it('shows quantity, name and cost, and selects on click or focus', () => {
    const props = renderRow();
    const row = screen.getByRole('row');
    expect(within(row).getByRole('img', { name: '{R}' })).toBeInTheDocument();
    expect(within(row).getByText('4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lightning Bolt' }));
    fireEvent.focus(row);
    expect(props.onSelect).toHaveBeenCalledTimes(2);
  });

  it('previews itself while the pointer is over it', () => {
    const onPreview = vi.fn();
    const props = renderRow({ onPreview });
    const row = screen.getByRole('row');
    fireEvent.pointerEnter(row);
    expect(onPreview).toHaveBeenLastCalledWith(true);
    fireEvent.pointerLeave(row);
    expect(onPreview).toHaveBeenLastCalledWith(false);
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('marks the selected row for assistive technology', () => {
    renderRow({ selected: true });
    expect(screen.getByRole('row')).toHaveAttribute('aria-selected', 'true');
  });

  it('routes the row menu to the row callbacks', () => {
    const props = renderRow();
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.trigger' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /DeckEditor.rowActions.removeOne/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.moveToSideboard' }));
    expect(props.onInc).toHaveBeenCalledWith(-1);
    expect(props.onSetCategory).toHaveBeenCalledWith('sideboard');
  });

  it('is a named grid row that opens its menu from Shift+F10 and returns focus on Escape', async () => {
    const user = userEvent.setup();
    renderRow();
    const row = screen.getByRole('row', { name: 'DeckEditor.row.label' });
    row.tabIndex = 0;
    row.focus();

    await user.keyboard('{Shift>}{F10}{/Shift}');
    expect(screen.getByRole('menu', { name: 'DeckEditor.rowActions.trigger' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /DeckEditor.rowActions.addOne/ })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(row).toHaveFocus();
  });

  it('opens the menu at the pointer on right-click, with the detail view in it', async () => {
    const user = userEvent.setup();
    const props = renderRow();
    fireEvent.contextMenu(screen.getByRole('row'), { clientX: 40, clientY: 50 });
    await user.click(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.details' }));
    expect(props.onShowDetails).toHaveBeenCalled();
  });

  it('announces a quantity change made from the open menu', () => {
    const props: DeckCardRowProps = {
      card: bolt, onSelect: vi.fn(), onInc: vi.fn(), onDelete: vi.fn(), onSetCategory: vi.fn(), onSetCommander: vi.fn(),
      onChangePrinting: vi.fn(), isMtg: true, isCommander: false,
    };
    const { rerender } = renderWithProviders(<DeckCardRow {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.trigger' }));
    const status = within(screen.getByRole('row')).getByRole('status');
    expect(status).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('menuitem', { name: /DeckEditor.rowActions.addOne/ }));
    expect(props.onInc).toHaveBeenCalledWith(1);
    rerender(<DeckCardRow {...props} card={{ ...bolt, quantity: 5 }} />);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(status).toHaveTextContent('DeckEditor.rowActions.quantityNow');
  });

  it('paints an illegal row and names the reason', () => {
    renderRow({ legality: { status: 'illegal', reason: 'tooMany', max: 4 } });
    const row = screen.getByRole('row');
    expect(row.className).toContain('bg-danger/10');
    expect(row).toHaveAttribute('title', 'DeckLegality.reason.tooMany');
    expect(within(row).getByRole('img', { name: 'DeckLegality.reason.tooMany' })).toBeInTheDocument();
  });

  it('describes the row\'s warnings to assistive technology, as its label replaces the content', () => {
    renderRow({ card: { ...bolt, lookupSource: 'unknown' }, legality: { status: 'illegal', reason: 'tooMany', max: 4 } });
    const row = screen.getByRole('row');
    expect(row).toHaveAttribute('aria-description', 'DeckEditor.row.unknown DeckLegality.reason.tooMany');
    expect(within(row).getByRole('img', { name: 'DeckEditor.row.unknown' })).toBeInTheDocument();
  });

  it('shows the commander crown and leaves legal rows unmarked', () => {
    renderRow({ card: { ...bolt, isCommander: true }, legality: { status: 'unknown' } });
    const row = screen.getByRole('row');
    expect(row.className).not.toContain('bg-danger');
    expect(within(row).getByRole('img', { name: 'DeckEditor.row.commander' })).toBeInTheDocument();
    expect(within(row).queryByRole('img', { name: /DeckLegality/ })).toBeNull();
  });
});

it('keeps a provisional row readable while suppressing warnings and all row menus', () => {
  renderRow({ card: { ...bolt, lookupSource: 'unknown' }, readOnly: true });
  expect(screen.getByRole('button', { name: 'Lightning Bolt' })).toBeVisible();
  expect(screen.queryByRole('img', { name: 'DeckEditor.row.unknown' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'DeckEditor.rowActions.trigger' })).not.toBeInTheDocument();
  fireEvent.contextMenu(screen.getByRole('row'));
  fireEvent.keyDown(screen.getByRole('row'), { key: 'F10', shiftKey: true });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
