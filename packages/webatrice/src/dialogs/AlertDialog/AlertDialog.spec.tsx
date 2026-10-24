import { useEffect, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import AlertDialog from './AlertDialog';
import DialogShell from '../DialogShell/DialogShell';

describe('AlertDialog', () => {
  it('renders the title, message, and default OK button', () => {
    renderWithProviders(
      <AlertDialog
        isOpen
        title="Error"
        message="The game is already full."
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('The game is already full.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^ok$/i })).toBeInTheDocument();
  });

  it('uses a custom buttonLabel when provided', () => {
    renderWithProviders(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        buttonLabel="Dismiss"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('fires onDismiss when the OK button is clicked', () => {
    const onDismiss = vi.fn();
    renderWithProviders(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^ok$/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('fires onDismiss on Escape key', () => {
    const onDismiss = vi.fn();
    renderWithProviders(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <AlertDialog
        isOpen={false}
        title="T"
        message="M"
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('autofocuses the dismiss button on open so Enter dismisses immediately', () => {
    renderWithProviders(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        onDismiss={() => {}}
      />,
    );

    const okButton = screen.getByRole('button', { name: /^ok$/i });
    expect(okButton).toHaveFocus();
  });

  it('traps focus within the dialog while open', () => {
    renderWithProviders(
      <>
        <button type="button">outside</button>
        <AlertDialog
          isOpen
          title="T"
          message="M"
          onDismiss={() => {}}
        />
      </>,
    );

    const okButton = screen.getByRole('button', { name: /^ok$/i });
    expect(okButton).toHaveFocus();

    const outside = screen.getByRole('button', { name: /outside/i, hidden: true });
    expect(document.activeElement).not.toBe(outside);
  });

  it('restores focus to the trigger when the dialog closes', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <AlertDialog
            isOpen={open}
            title="T"
            message="M"
            onDismiss={() => setOpen(false)}
          />
        </>
      );
    }

    renderWithProviders(<Host />);

    const trigger = screen.getByRole('button', { name: 'open' });
    trigger.focus();
    expect(trigger).toHaveFocus();

    act(() => {
      fireEvent.click(trigger);
    });

    const okButton = screen.getByRole('button', { name: /^ok$/i });
    expect(okButton).toHaveFocus();

    act(() => {
      fireEvent.click(okButton);
    });

    expect(trigger).toHaveFocus();
  });

  it('applies the error color variant by default and primary for info severity', () => {
    const { rerender } = renderWithProviders(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /^ok$/i }).className).toMatch(/colorError/);

    rerender(
      <AlertDialog
        isOpen
        title="T"
        message="M"
        severity="info"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /^ok$/i }).className).toMatch(/colorPrimary/);
  });
});

it('renders warning severity and keeps optional server details collapsed', () => {
  renderWithProviders(<AlertDialog isOpen title="Warning" message="Explanation" severity="warning"
    details="Server supplied details" onDismiss={() => {}} />);
  expect(screen.getByRole('button', { name: /^ok$/i })).toHaveClass('MuiButton-colorWarning');
  const details = screen.getByText('Server supplied details').closest('details')!;
  expect(details.open).toBe(false);
  expect(screen.getByText('AlertDialog.details').tagName).toBe('SUMMARY');
  expect(screen.getByText('Server supplied details')).not.toBeVisible();
  fireEvent.click(screen.getByText('AlertDialog.details'));
  expect(details.open).toBe(true);
  expect(screen.getByText('Server supplied details')).toBeVisible();
});

it('inherits the opener when replacing a loading dialog', async () => {
  const user = userEvent.setup();
  function Flow() {
    const [stage, setStage] = useState('idle');
    return <>
      <button type="button" onClick={() => setStage('loading')}>History</button>
      {stage === 'loading' && <DialogShell isOpen title="Loading">
        <button type="button" onClick={() => setStage('alert')}>Complete</button>
      </DialogShell>}
      <AlertDialog isOpen={stage === 'alert'} title="History" message="Empty" onDismiss={() => setStage('idle')} />
    </>;
  }
  renderWithProviders(<Flow />);
  const opener = screen.getByRole('button', { name: 'History' });
  await user.click(opener);
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
});

it('retains the opener when the alert takes focus before the loading layer leaves', async () => {
  const user = userEvent.setup();
  function Flow() {
    const [stage, setStage] = useState('idle');
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      if (stage === 'alert') {
        setLoading(false);
      }
    }, [stage]);
    return <>
      <button type="button" onClick={() => {
        setLoading(true); setStage('loading');
      }}>History</button>
      {loading && <DialogShell isOpen title="Loading">
        <button type="button" onClick={() => setStage('alert')}>Complete</button>
      </DialogShell>}
      <AlertDialog isOpen={stage === 'alert'} title="History" message="Empty" onDismiss={() => setStage('idle')} />
    </>;
  }
  renderWithProviders(<Flow />);
  const opener = screen.getByRole('button', { name: 'History' });
  await user.click(opener);
  await user.keyboard('{Enter}');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
});
