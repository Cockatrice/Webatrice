import { fireEvent, render, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { ServerInfo_DeckShareSummarySchema } from '@cockatrice/sockatrice/generated';

import { DeckShareLinksDialog } from './DeckShareLinksDialog';

const cube = create(ServerInfo_DeckShareSummarySchema, { id: 4, name: 'Cube', itemCount: 2, creationTime: 1n, expiresAt: 2n });

function renderDialog(props: Partial<Parameters<typeof DeckShareLinksDialog>[0]> = {}) {
  const all = { shares: [cube], error: null, onRevoke: vi.fn(), onClose: vi.fn(), ...props };
  render(<DeckShareLinksDialog {...all} />);
  return all;
}

describe('DeckShareLinksDialog', () => {
  it('lists the links with their deck count and dates', () => {
    renderDialog();
    expect(screen.getByText('Cube')).toBeInTheDocument();
    expect(screen.getByText('DeckShareLinks.summary')).toBeInTheDocument();
  });

  it('revokes a link only after confirming', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revokeNamed' }));
    expect(props.onRevoke).not.toHaveBeenCalled();
    expect(screen.getByText('DeckShareLinks.confirmRevoke')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revoke' }));
    expect(props.onRevoke).toHaveBeenCalledWith(4);
    expect(screen.queryByText('DeckShareLinks.confirmRevoke')).toBeNull();
  });

  it('brings the confirmation into view and focuses its Revoke button', () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revokeNamed' }));
    expect(screen.getByRole('button', { name: 'DeckShareLinks.revoke' })).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('keeps the link when the confirmation is cancelled', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'DeckShareLinks.revokeNamed' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckSharing.cancel' }));
    expect(props.onRevoke).not.toHaveBeenCalled();
  });

  it('shows loading, empty and error states', () => {
    const { unmount } = render(<DeckShareLinksDialog shares={null} error={null} onRevoke={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('DeckShareLinks.loading');
    unmount();
    renderDialog({ shares: [] });
    expect(screen.getByText('DeckShareLinks.none')).toBeInTheDocument();
  });

  it('shows a failure', () => {
    renderDialog({ error: 'DeckShareLinks.revokeFailed' });
    expect(screen.getByRole('alert')).toHaveTextContent('DeckShareLinks.revokeFailed');
  });
});
