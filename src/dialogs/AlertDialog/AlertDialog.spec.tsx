import { useState } from 'react';
import { screen, fireEvent, act } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import AlertDialog from './AlertDialog';

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
