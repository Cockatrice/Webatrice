import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeckDialogFrame } from './DeckDialogFrame';

function Host({ onEscape }: { onEscape?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      {open && (
        <DeckDialogFrame onClose={() => setOpen(false)} titleId="frame-title" onEscape={onEscape}>
          <div>
            <button type="button" onClick={() => setOpen(false)}>Close</button>
            <h2 id="frame-title">Frame</h2>
            <div data-dialog-content>
              <input aria-label="Name" />
              <button type="button">Save</button>
            </div>
          </div>
        </DeckDialogFrame>
      )}
    </>
  );
}

describe('DeckDialogFrame', () => {
  it('is a named modal dialog that takes focus into its content, past the Close button', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog', { name: 'Frame' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it('closes on Escape and gives focus back to the opener', async () => {
    const user = userEvent.setup();
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('runs onEscape instead of closing when one is given', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    render(<Host onEscape={onEscape} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
