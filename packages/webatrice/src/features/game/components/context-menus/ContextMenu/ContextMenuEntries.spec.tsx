import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Menu } from '@app/components';

import type { ContextMenuItem } from './ContextMenu';
import ContextMenuEntries from './ContextMenuEntries';

function renderMenu(items: ContextMenuItem[], onClose = vi.fn()) {
  render(
    <Menu anchor={{ x: 10, y: 10 }} label="Hand" onClose={onClose}>
      <ContextMenuEntries items={items} />
    </Menu>,
  );
  return { menu: screen.getByRole('menu', { name: 'Hand' }), onClose };
}

describe('ContextMenuEntries', () => {
  it('forwards normalized shortcuts for action and checkbox entries', () => {
    const rebound = { shortcut: 'Ctrl+Shift+Y', keyShortcuts: 'Control+Shift+Y Alt+Z' };
    renderMenu([
      { label: 'Sort hand', onClick: vi.fn(), ...rebound },
      { label: 'Reveal hand', checked: true, onClick: vi.fn(), ...rebound },
    ]);
    expect(screen.getByRole('menuitem', { name: 'Sort hand' }))
      .toHaveAttribute('aria-keyshortcuts', rebound.keyShortcuts);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Reveal hand' }))
      .toHaveAttribute('aria-keyshortcuts', rebound.keyShortcuts);
  });

  it('draws items, dividers, check items, placeholders and submenus as menu entries', () => {
    const { menu } = renderMenu([
      { label: 'View hand', onClick: vi.fn() },
      { divider: true },
      { label: 'Reveal hand', checked: true, onClick: vi.fn() },
      { label: 'Not wired yet' },
      { label: 'Move hand to', submenu: [{ label: 'Graveyard', onClick: vi.fn() }] },
    ]);
    expect(within(menu).getByRole('menuitem', { name: 'View hand' })).toBeInTheDocument();
    expect(within(menu).getByRole('separator')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Reveal hand' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Not wired yet' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Move hand to' })).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('runs an item from the keyboard and closes the menu, as a click does', async () => {
    const user = userEvent.setup();
    const view = vi.fn();
    const { onClose } = renderMenu([{ label: 'View hand', onClick: view }, { label: 'Mulligan', onClick: vi.fn() }]);
    expect(screen.getByRole('menuitem', { name: 'View hand' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(view).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('opens a submenu with the right arrow and runs its item', async () => {
    const user = userEvent.setup();
    const toGrave = vi.fn();
    renderMenu([{ label: 'Move hand to', submenu: [{ label: 'Graveyard', onClick: toGrave }] }]);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Graveyard' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(toGrave).toHaveBeenCalledTimes(1);
  });
});
