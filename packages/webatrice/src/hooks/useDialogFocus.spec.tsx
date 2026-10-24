import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { tabbableElements, useDialogFocus, type ReturnFocusTo } from './useDialogFocus';

interface DialogProps {
  isOpen: boolean;
  onEscape?: () => void;
  returnFocusTo?: ReturnFocusTo;
  modal?: boolean;
  moveFocusIn?: boolean;
  children?: React.ReactNode;
}

function Dialog({ isOpen, onEscape, returnFocusTo, modal, moveFocusIn, children }: DialogProps) {
  const { getDialogProps } = useDialogFocus({ isOpen, onEscape, returnFocusTo, modal, moveFocusIn });
  return isOpen ? <div role="dialog" aria-modal="true" aria-label="Dialog" {...getDialogProps()}>{children}</div> : null;
}

function Host({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <Dialog isOpen={open} onEscape={() => setOpen(false)}>{children}</Dialog>
    </>
  );
}

describe('useDialogFocus', () => {
  it('focuses the dialog itself when it has no controls, and keeps Tab there', async () => {
    const user = userEvent.setup();
    render(<Host>Nothing to press</Host>);
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('prefers a control in [data-dialog-content] over one before it', async () => {
    const user = userEvent.setup();
    render(
      <Host>
        <button type="button">Header</button>
        <div data-dialog-content><button type="button">Body</button></div>
      </Host>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('button', { name: 'Body' })).toHaveFocus();
  });

  it('skips disabled and hidden controls when cycling', async () => {
    const user = userEvent.setup();
    render(
      <Host>
        <button type="button">First</button>
        <button type="button" disabled>Off</button>
        <div hidden><button type="button">Hidden</button></div>
        <button type="button">Last</button>
      </Host>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.tab();
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('leaves focus alone on close when something outside already took it', () => {
    const { rerender } = render(
      <>
        <button type="button">Opener</button>
        <button type="button">Other</button>
        <Dialog isOpen={false}><button type="button">Inside</button></Dialog>
      </>,
    );
    screen.getByRole('button', { name: 'Opener' }).focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <button type="button">Other</button>
        <Dialog isOpen><button type="button">Inside</button></Dialog>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

    screen.getByRole('button', { name: 'Other' }).focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <button type="button">Other</button>
        <Dialog isOpen={false}><button type="button">Inside</button></Dialog>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Other' })).toHaveFocus();
  });

  it('returns focus to the original opener when a dialog is swapped for one with an autoFocus field', async () => {
    const user = userEvent.setup();
    function Flow() {
      const [stage, setStage] = useState<'idle' | 'loading' | 'form'>('idle');
      return (
        <>
          <button type="button" onClick={() => setStage('loading')}>Warn</button>
          {stage === 'loading' && (
            <Dialog isOpen><button type="button" onClick={() => setStage('form')}>Loaded</button></Dialog>
          )}
          {stage === 'form' && (
            <Dialog isOpen onEscape={() => setStage('idle')}>
              <input aria-label="Reason" autoFocus />
            </Dialog>
          )}
        </>
      );
    }
    render(<Flow />);
    await user.click(screen.getByRole('button', { name: 'Warn' }));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('textbox', { name: 'Reason' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Warn' })).toHaveFocus();
  });

  it('returns focus to the opener of a dialog whose content has an autoFocus field', async () => {
    const user = userEvent.setup();
    render(<Host><input aria-label="Name" autoFocus /></Host>);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('sends focus to returnFocusTo when the opener unmounted while the dialog was open', async () => {
    const user = userEvent.setup();
    function List() {
      const [rows, setRows] = useState(['ann', 'bob']);
      const [open, setOpen] = useState(false);
      return (
        <>
          <ul aria-label="Users">
            {rows.map((row) => <li key={row}><button type="button" onClick={() => setOpen(true)}>{row}</button></li>)}
          </ul>
          <Dialog
            isOpen={open}
            onEscape={() => setOpen(false)}
            returnFocusTo={(opener) => opener.closest('ul')}
          >
            <button type="button" onClick={() => setRows(['bob'])}>Remove ann</button>
          </Dialog>
        </>
      );
    }
    render(<List />);
    await user.click(screen.getByRole('button', { name: 'ann' }));
    await user.click(screen.getByRole('button', { name: 'Remove ann' }));

    await user.keyboard('{Escape}');

    expect(screen.getByRole('list', { name: 'Users' })).toHaveFocus();
  });

  it('falls back to the nearest landmark when the opener unmounted and no returnFocusTo is given', async () => {
    const user = userEvent.setup();
    function Page() {
      const [shown, setShown] = useState(true);
      const [open, setOpen] = useState(false);
      return (
        <main aria-label="Page">
          {shown && <button type="button" onClick={() => setOpen(true)}>Open</button>}
          <Dialog isOpen={open} onEscape={() => setOpen(false)}>
            <button type="button" onClick={() => setShown(false)}>Hide opener</button>
          </Dialog>
        </main>
      );
    }
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Hide opener' }));

    await user.keyboard('{Escape}');

    const main = screen.getByRole('main', { name: 'Page' });
    expect(main).toHaveFocus();
    await user.tab();
    expect(main).not.toHaveFocus();
    expect(main).not.toHaveAttribute('tabindex');
  });

  it('takes focus back when the focused control unmounts, so Escape still closes', async () => {
    const user = userEvent.setup();
    function Busy() {
      const [open, setOpen] = useState(false);
      const [busy, setBusy] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Dialog isOpen={open} onEscape={() => setOpen(false)}>
            {busy ? <span>Working</span> : <button type="button" onClick={() => setBusy(true)}>Go</button>}
          </Dialog>
        </>
      );
    }
    render(<Busy />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.click(screen.getByRole('button', { name: 'Go' }));

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });
});

describe('useDialogFocus for a non-modal panel', () => {
  function Panel({ moveFocusIn }: { moveFocusIn?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Open</button>
        <Dialog isOpen={open} onEscape={() => setOpen(false)} modal={false} moveFocusIn={moveFocusIn}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Dialog>
        <button type="button">After</button>
      </>
    );
  }

  it('lets Tab move on past its last control, and still closes on Escape with focus back on the opener', async () => {
    const user = userEvent.setup();
    render(<Panel />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'First' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  it('leaves focus where it was on open when asked not to move it', async () => {
    const user = userEvent.setup();
    render(<Panel moveFocusIn={false} />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });
});

describe('tabbableElements', () => {
  it('leaves out what the browser does not tab to', () => {
    const { container } = render(
      <div>
        <button type="button">Button</button>
        <button type="button" tabIndex={-1}>Skipped button</button>
        <a href="#x">Link</a>
        <a href="#y" tabIndex={-1}>Skipped link</a>
        <input aria-label="Native select mirror" tabIndex={-1} />
        <button type="button" style={{ display: 'none' }}>Not displayed</button>
        <div style={{ display: 'none' }}><button type="button">Inside not displayed</button></div>
        <button type="button" style={{ visibility: 'hidden' }}>Invisible</button>
        <input type="radio" name="duration" aria-label="Minutes" />
        <input type="radio" name="duration" aria-label="Permanent" defaultChecked />
        <input type="radio" name="kind" aria-label="First" />
        <input type="radio" name="kind" aria-label="Second" />
      </div>,
    );

    const labels = tabbableElements(container.firstElementChild as HTMLElement)
      .map((element) => element.getAttribute('aria-label') ?? element.textContent);

    expect(labels).toEqual(['Button', 'Link', 'Permanent', 'First']);
  });
});
