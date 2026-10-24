import { createRef } from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../../../__test-utils__';
import type { DeckCard } from '../../types';
import { DeckRowActionsMenu } from './DeckRowActionsMenu';

const atraxa: DeckCard = { name: 'Atraxa', quantity: 2, category: 'main', lookupSource: 'scryfall' };

function renderMenu(card: DeckCard = atraxa, flags = { isMtg: true, isCommander: true }, extra = {}) {
  const handlers = {
    onClose: vi.fn(),
    onInc: vi.fn(),
    onDec: vi.fn(),
    onDelete: vi.fn(),
    onSetCategory: vi.fn(),
    onSetCommander: vi.fn(),
    onChangePrinting: vi.fn(),
    ...extra,
  };
  renderWithProviders(
    <DeckRowActionsMenu
      card={card}
      anchor={{ x: 10, y: 10 }}
      triggerRef={createRef<HTMLElement>()}
      {...handlers}
      {...flags}
    />,
  );
  return handlers;
}

describe('DeckRowActionsMenu', () => {
  it('is a menu named for the card that takes focus on its first entry', () => {
    renderMenu();
    expect(screen.getByRole('menu', { name: 'DeckEditor.rowActions.trigger' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /DeckEditor.rowActions.addOne/ })).toHaveFocus();
  });

  it('adds and removes copies without closing, and hints the rebindable shortcuts', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    const add = screen.getByRole('menuitem', { name: /DeckEditor.rowActions.addOne/ });
    expect(add).toHaveAttribute('aria-keyshortcuts');

    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(handlers.onInc).toHaveBeenCalledTimes(1);
    expect(handlers.onDec).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).not.toHaveBeenCalled();
  });

  it('runs the keys its add and remove entries advertise while it is open', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    const add = screen.getByRole('menuitem', { name: /DeckEditor.rowActions.addOne/ });

    await user.keyboard('[Equal]');
    await user.keyboard('{Shift>}[Equal]{/Shift}');
    await user.keyboard('[Minus]');
    expect(handlers.onInc).toHaveBeenCalledTimes(2);
    expect(handlers.onDec).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).not.toHaveBeenCalled();
    expect(add).toHaveFocus();
  });

  it('closes when its remove key takes the last copy', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu({ ...atraxa, quantity: 1 });
    await user.keyboard('[Minus]');
    expect(handlers.onDec).toHaveBeenCalledTimes(1);
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('closes after removing the last copy, which removes the row', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu({ ...atraxa, quantity: 1 });
    await user.click(screen.getByRole('menuitem', { name: /DeckEditor.rowActions.removeOne/ }));
    expect(handlers.onDec).toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('runs an action and closes', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    await user.click(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.markCommander' }));
    expect(handlers.onSetCommander).toHaveBeenCalledWith(true);
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('offers the detail view when the deck has one', async () => {
    const user = userEvent.setup();
    const onShowDetails = vi.fn();
    renderMenu(atraxa, { isMtg: true, isCommander: false }, { onShowDetails });
    await user.click(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.details' }));
    expect(onShowDetails).toHaveBeenCalled();
  });

  it('offers moving a sideboard card to main', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu({ ...atraxa, category: 'sideboard' });
    await user.click(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.moveToMain' }));
    expect(handlers.onSetCategory).toHaveBeenCalledWith('main');
  });

  it('keeps sideboarding a commander reachable but off, and says why', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu({ ...atraxa, isCommander: true });
    const item = screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.moveToSideboard' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('DeckEditor.rowActions.commanderStaysMain');
    await user.click(item);
    expect(handlers.onSetCategory).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'DeckEditor.rowActions.unmarkCommander' })).toBeInTheDocument();
  });

  it('drops the detail, printing and commander items for decks that cannot use them', () => {
    renderMenu(atraxa, { isMtg: false, isCommander: false });
    expect(screen.queryByRole('menuitem', { name: 'DeckEditor.rowActions.details' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'DeckEditor.rowActions.changePrinting' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Commander/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Common.action.remove' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const handlers = renderMenu();
    await user.keyboard('{Escape}');
    expect(handlers.onClose).toHaveBeenCalled();
  });
});
