import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DeckShareCreateState } from '../hooks/useDeckSharing';
import { ShareDeckDialog } from './ShareDeckDialog';

function renderDialog(state: DeckShareCreateState = { status: 'idle' }) {
  const props = { open: true, defaultName: 'Shared decks', state, onClose: vi.fn(), onCreate: vi.fn() };
  render(<ShareDeckDialog {...props} />);
  return props;
}

const nameField = () => screen.getByRole('textbox', { name: 'DeckSharing.nameLabel' });

describe('ShareDeckDialog', () => {
  it('starts from desktop\'s default name and creates the link with the typed one', async () => {
    const props = renderDialog();
    expect(nameField()).toHaveValue('Shared decks');
    fireEvent.change(nameField(), { target: { value: '  Cube  ' } });
    fireEvent.click(screen.getByRole('button', { name: /DeckSharing.create/ }));
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledWith('Cube'));
  });

  it('falls back to the default name when left empty, like desktop', async () => {
    const props = renderDialog();
    fireEvent.change(nameField(), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /DeckSharing.create/ }));
    await waitFor(() => expect(props.onCreate).toHaveBeenCalledWith('Shared decks'));
  });

  it('waits for the server', () => {
    renderDialog({ status: 'pending' });
    expect(screen.getByRole('status')).toHaveTextContent('DeckSharing.creating');
    expect(screen.getByRole('button', { name: /DeckSharing.create/ })).toBeDisabled();
  });

  it('shows the created link, its expiry and whether it was copied', () => {
    renderDialog({ status: 'created', link: 'https://x/#share=t', expiresAt: 1800000000n, itemCount: 1, copied: true });
    expect(screen.getByRole('status')).toHaveTextContent('DeckSharing.createdCopied');
    expect(screen.getByRole('textbox', { name: 'DeckSharing.linkLabel' })).toHaveValue('https://x/#share=t');
    expect(screen.getByText('DeckSharing.expires')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /DeckSharing.create/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'DeckSharing.close' })).toBeInTheDocument();
  });

  it('copies the link again on request', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog({ status: 'created', link: 'https://x/#share=t', expiresAt: 1n, itemCount: 1, copied: false });
    expect(screen.getByRole('status')).toHaveTextContent('DeckSharing.created');
    fireEvent.click(screen.getByRole('button', { name: /DeckSharing.copy/ }));
    expect(writeText).toHaveBeenCalledWith('https://x/#share=t');
    expect(await screen.findByRole('button', { name: /DeckSharing.copied/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('DeckSharing.copied');
  });

  it('announces a second copy afresh, emptying the status while it copies', async () => {
    let finish = () => {};
    const writeText = vi.fn(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog({ status: 'created', link: 'https://x/#share=t', expiresAt: 1n, itemCount: 1, copied: true });
    const status = screen.getByRole('status');

    for (let copy = 0; copy < 2; copy++) {
      fireEvent.click(screen.getByRole('button', { name: /DeckSharing.cop/ }));
      expect(status).toBeEmptyDOMElement();
      await act(async () => finish());
      expect(status).toHaveTextContent('DeckSharing.copied');
    }
  });

  it('says when the copy fails and selects the link for copying by hand', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderDialog({ status: 'created', link: 'https://x/#share=t', expiresAt: 1n, itemCount: 1, copied: false });
    const link = screen.getByRole<HTMLInputElement>('textbox', { name: 'DeckSharing.linkLabel' });
    const copyButton = screen.getByRole('button', { name: /DeckSharing.copy/ });
    copyButton.focus();
    link.setSelectionRange(link.value.length, link.value.length);
    expect(copyButton).toHaveFocus();
    expect(link.selectionStart).toBe(link.value.length);
    fireEvent.click(copyButton);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('DeckSharing.copyFailed'));
    expect(screen.getAllByText('DeckSharing.copyFailed')).toHaveLength(2);
    expect(link).toHaveFocus();
    expect(link.selectionStart).toBe(0);
    expect(link.selectionEnd).toBe(link.value.length);
    expect(screen.queryByRole('button', { name: /DeckSharing.copied/ })).toBeNull();
  });

  it('moves focus to the new link when the name step goes away, and announces it from the same region', () => {
    const props = { open: true, defaultName: 'Shared decks', onClose: vi.fn(), onCreate: vi.fn() };
    const { rerender } = render(<ShareDeckDialog {...props} state={{ status: 'idle' }} />);
    expect(nameField()).toHaveFocus();
    const status = screen.getByRole('status');

    rerender(<ShareDeckDialog {...props} state={{ status: 'pending' }} />);
    expect(status).toHaveTextContent('DeckSharing.creating');
    rerender(
      <ShareDeckDialog
        {...props}
        state={{ status: 'created', link: 'https://x/#share=t', expiresAt: 1n, itemCount: 1, copied: true }}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'DeckSharing.linkLabel' })).toHaveFocus();
    expect(screen.getByRole('status')).toBe(status);
    expect(status).toHaveTextContent('DeckSharing.createdCopied');
  });

  it('shows a failure and lets the user try again', () => {
    renderDialog({ status: 'failed', message: 'DeckSharing.createFailed' });
    expect(screen.getByRole('alert')).toHaveTextContent('DeckSharing.createFailed');
    expect(screen.getByRole('button', { name: /DeckSharing.create/ })).toBeEnabled();
  });

  it('renders nothing while closed', () => {
    const { container } = render(
      <ShareDeckDialog open={false} defaultName="x" state={{ status: 'idle' }} onClose={vi.fn()} onCreate={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
