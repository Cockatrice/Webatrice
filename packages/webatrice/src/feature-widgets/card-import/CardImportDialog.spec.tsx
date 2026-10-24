import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

vi.mock('./CardImportForm', () => ({
  default: ({ onViewSets }: { onViewSets: () => void }) => (
    <button type="button" data-testid="card-import-form" onClick={onViewSets}>view sets</button>
  ),
}));
vi.mock('./CardDatabaseOverview', () => ({ default: () => <div data-testid="card-database-overview" /> }));
vi.mock('./ManageSets', () => ({ default: () => <div data-testid="manage-sets" /> }));
vi.mock('./EditTokens', () => ({ default: () => <div data-testid="edit-tokens" /> }));

import CardImportDialog from './CardImportDialog';

describe('CardImportDialog', () => {
  it('renders nothing visible when closed', () => {
    renderWithProviders(<CardImportDialog isOpen={false} handleClose={vi.fn()} />);

    expect(screen.queryByText('CardImportDialog.title')).toBeNull();
  });

  it('opens on the import tab by default', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /CardImportDialog.title/ })).toBeInTheDocument();
    expect(screen.getByTestId('card-import-form')).toBeInTheDocument();
  });

  it('labels the shown panel with its tab', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} initialTab="tokens" />);
    const tab = screen.getByRole('tab', { name: 'CardImportDialog.tab.tokens' });
    const panel = screen.getByRole('tabpanel', { name: 'CardImportDialog.tab.tokens' });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });

  it('opens on the requested tab', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} initialTab="tokens" />);
    expect(screen.getByTestId('edit-tokens')).toBeInTheDocument();
  });

  it('switches between the card database tabs', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('tab', { name: 'CardImportDialog.tab.database' }));
    expect(screen.getByTestId('card-database-overview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'CardImportDialog.tab.sets' }));
    expect(screen.getByTestId('manage-sets')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'CardImportDialog.tab.tokens' }));
    expect(screen.getByTestId('edit-tokens')).toBeInTheDocument();
  });

  it('jumps to Manage sets when an import answers "View sets"', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('card-import-form'));
    expect(screen.getByTestId('manage-sets')).toBeInTheDocument();
  });

  it('calls handleClose from the close button', () => {
    const handleClose = vi.fn();
    renderWithProviders(<CardImportDialog isOpen handleClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'CardImportDialog.close' }));
    expect(handleClose).toHaveBeenCalled();
  });
});
