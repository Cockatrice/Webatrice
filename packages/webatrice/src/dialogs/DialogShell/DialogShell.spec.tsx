import { useRef, useState } from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Menu, MenuItem } from '@app/components';
import { DialogReturnFocusContext, closestList } from '@app/hooks';

import { renderWithProviders } from '../../__test-utils__';
import DialogShell from './DialogShell';

function Opener({ autofocus = false }: { autofocus?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <DialogShell isOpen={open} handleClose={() => setOpen(false)} title="Edit host" description="Change the address">
        <input aria-label="Name" />
        <input aria-label="Address" data-autofocus={autofocus || undefined} />
      </DialogShell>
    </>
  );
}

describe('DialogShell', () => {
  it('does not leak a dialog form submit to an ancestor form', () => {
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const innerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    renderWithProviders(
      <form onSubmit={outerSubmit}>
        <DialogShell isOpen title="Add host">
          <form onSubmit={innerSubmit}>
            <button type="submit">Add Host</button>
          </form>
        </DialogShell>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /add host/i }));

    expect(innerSubmit).toHaveBeenCalledTimes(1);
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it('is named by its heading and described by its description', () => {
    renderWithProviders(<DialogShell isOpen title="Edit host" description="Change the address">body</DialogShell>);

    const dialog = screen.getByRole('dialog', { name: 'Edit host' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Change the address');
  });

  it('moves focus to the first control of its content, or to a data-autofocus control', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    unmount();

    renderWithProviders(<Opener autofocus />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveFocus();
  });

  it('keeps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.tab();
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Common.action.close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('textbox', { name: 'Address' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveFocus();
  });

  it('closes on Escape and gives focus back to the control that opened it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Opener />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('ignores Escape when it cannot be closed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogShell isOpen title="Busy"><button type="button">Ok</button></DialogShell>);

    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { name: 'Busy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Common.action.close' })).not.toBeInTheDocument();
  });

  it('lets a dialog opened from inside another close on its own', async () => {
    const user = userEvent.setup();
    const outerClose = vi.fn();
    function Stacked() {
      const [inner, setInner] = useState(false);
      return (
        <DialogShell isOpen handleClose={outerClose} title="Outer">
          <button type="button" onClick={() => setInner(true)}>More</button>
          <DialogShell isOpen={inner} handleClose={() => setInner(false)} title="Inner">
            <button type="button">Inner action</button>
          </DialogShell>
        </DialogShell>
      );
    }
    renderWithProviders(<Stacked />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Inner action' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Outer' })).toBeInTheDocument();
    expect(outerClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });

  it('returns focus to the list a DialogReturnFocusContext names when the row that opened it is gone', async () => {
    const user = userEvent.setup();
    function Rows() {
      const [rows, setRows] = useState(['ann', 'bob']);
      const [open, setOpen] = useState(false);
      return (
        <>
          <div role="list" aria-label="Players">
            {rows.map((row) => (
              <div role="listitem" key={row}><button type="button" onClick={() => setOpen(true)}>{row}</button></div>
            ))}
          </div>
          <DialogReturnFocusContext.Provider value={closestList}>
            <DialogShell isOpen={open} handleClose={() => setOpen(false)} title="Warn">
              <button type="button" onClick={() => setRows(['bob'])}>ann leaves</button>
            </DialogShell>
          </DialogReturnFocusContext.Provider>
        </>
      );
    }
    renderWithProviders(<Rows />);
    await user.click(screen.getByRole('button', { name: 'ann' }));
    await user.click(screen.getByRole('button', { name: 'ann leaves' }));

    await user.keyboard('{Escape}');

    expect(screen.getByRole('list', { name: 'Players' })).toHaveFocus();
  });

  it('returns focus to a menu trigger when a menu item opens a dialog with an autoFocus field', async () => {
    const user = userEvent.setup();
    function MenuThenDialog() {
      const [menuOpen, setMenuOpen] = useState(false);
      const [dialogOpen, setDialogOpen] = useState(false);
      const trigger = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={trigger} type="button" onClick={() => setMenuOpen(true)}>Actions</button>
          {menuOpen && (
            <Menu anchor={{ x: 0, y: 0 }} label="Actions" onClose={() => setMenuOpen(false)} triggerRef={trigger}>
              <MenuItem onSelect={() => setDialogOpen(true)}>Filter</MenuItem>
            </Menu>
          )}
          <DialogShell isOpen={dialogOpen} handleClose={() => setDialogOpen(false)} title="Filter games">
            <input aria-label="Description" autoFocus />
          </DialogShell>
        </>
      );
    }
    renderWithProviders(<MenuThenDialog />);
    screen.getByRole('button', { name: 'Actions' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });
});

it('isolates background and lower dialogs, then releases them in stack order', async () => {
  const user = userEvent.setup();
  function Stack() {
    const [first, setFirst] = useState(false);
    const [second, setSecond] = useState(false);
    return <>
      <button type="button" onClick={() => setFirst(true)}>Start</button>
      <DialogShell isOpen={first} handleClose={() => setFirst(false)} title="First">
        <button type="button" onClick={() => setSecond(true)}>Next</button>
      </DialogShell>
      <DialogShell isOpen={second} handleClose={() => setSecond(false)} title="Second">Top</DialogShell>
    </>;
  }
  renderWithProviders(<Stack />);
  const start = screen.getByRole('button', { name: 'Start' });
  await user.click(start);
  expect(start.closest('[inert]')).not.toBeNull();
  const next = screen.getByRole('button', { name: 'Next' });
  await user.click(next);
  expect(next.closest('[inert]')).not.toBeNull();
  start.focus();
  expect(screen.getByRole('dialog', { name: 'Second' }).contains(document.activeElement)).toBe(true);
  await user.keyboard('{Escape}');
  expect(next.closest('[inert]')).toBeNull();
  expect(next).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(start.closest('[inert]')).toBeNull();
  expect(start).toHaveFocus();
});

it('isolates late portals and preserves their original inert state on close', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Opener />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  const notification = document.createElement('button');
  const alreadyInert = document.createElement('div');
  alreadyInert.setAttribute('inert', '');
  document.body.append(notification, alreadyInert);
  try {
    await waitFor(() => expect(notification).toHaveAttribute('inert'));
    await user.keyboard('{Escape}');
    expect(notification).not.toHaveAttribute('inert');
    expect(alreadyInert).toHaveAttribute('inert');
  } finally {
    notification.remove();
    alreadyInert.remove();
  }
});

it('allows a menu opened inside the active dialog to take focus', async () => {
  const user = userEvent.setup();
  function Content() {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    return <DialogShell isOpen title="Modal">
      <button ref={trigger} type="button" onClick={() => setOpen(true)}>Actions</button>
      {open && <Menu anchor={{ x: 0, y: 0 }} label="Actions" onClose={() => setOpen(false)} triggerRef={trigger}>
        <MenuItem onSelect={vi.fn()}>Choose</MenuItem>
      </Menu>}
    </DialogShell>;
  }
  renderWithProviders(<Content />);
  await user.keyboard('{Enter}');
  const item = screen.getByRole('menuitem', { name: 'Choose' });
  expect(item.closest('[inert]')).toBeNull();
  expect(item).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  expect(screen.getByRole('dialog', { name: 'Modal' })).toBeInTheDocument();
});
