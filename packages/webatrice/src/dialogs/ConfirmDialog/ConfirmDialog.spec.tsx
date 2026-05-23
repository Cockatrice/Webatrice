import { useState } from 'react';
import { screen, fireEvent, act } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders the title, message, and default confirm/cancel labels', () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="Concede this game?"
        message="This can't be undone except by unconcede."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Concede this game?')).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('fires onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        confirmLabel="Concede"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /concede/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('fires onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen={false}
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('fires onCancel when Escape is pressed', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('autofocuses the confirm button on open', () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus();
  });

  it('keeps focus inside the dialog rather than on outside controls', () => {
    renderWithProviders(
      <>
        <button type="button">outside</button>
        <ConfirmDialog
          isOpen
          title="T"
          message="M"
          onConfirm={() => {}}
          onCancel={() => {}}
        />
      </>,
    );

    const outside = screen.getByRole('button', { name: /outside/i, hidden: true });
    expect(document.activeElement).not.toBe(outside);
    expect(screen.getByRole('button', { name: /confirm/i })).toHaveFocus();
  });

  it('restores focus to the trigger after the dialog closes via confirm', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>open</button>
          <ConfirmDialog
            isOpen={open}
            title="T"
            message="M"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }

    renderWithProviders(<Host />);

    const trigger = screen.getByRole('button', { name: 'open' });
    trigger.focus();

    act(() => {
      fireEvent.click(trigger);
    });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toHaveFocus();

    act(() => {
      fireEvent.click(confirmButton);
    });

    expect(trigger).toHaveFocus();
  });

  it('renders the destructive variant with error coloring on the confirm button', () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        destructive
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /confirm/i }).className).toMatch(/colorError/);
  });

  it('uses custom confirm/cancel labels when provided', () => {
    renderWithProviders(
      <ConfirmDialog
        isOpen
        title="T"
        message="M"
        confirmLabel="Concede"
        cancelLabel="Keep playing"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: /concede/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep playing/i })).toBeInTheDocument();
  });
});
