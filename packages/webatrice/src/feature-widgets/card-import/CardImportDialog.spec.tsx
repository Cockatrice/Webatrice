import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../__test-utils__';

// CardImportForm has its own spec; stub it so this covers only the dialog shell.
vi.mock('./CardImportForm', () => ({
  default: () => <div data-testid="card-import-form" />,
}));

import CardImportDialog from './CardImportDialog';

describe('CardImportDialog', () => {
  it('renders nothing visible when closed', () => {
    renderWithProviders(<CardImportDialog isOpen={false} handleClose={vi.fn()} />);

    expect(screen.queryByText('Import Cards')).toBeNull();
  });

  it('renders the title and the import form when open', () => {
    renderWithProviders(<CardImportDialog isOpen handleClose={vi.fn()} />);

    expect(screen.getByText('Import Cards')).toBeInTheDocument();
    expect(screen.getByTestId('card-import-form')).toBeInTheDocument();
  });

  it('calls handleClose when the close icon button is clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(<CardImportDialog isOpen handleClose={handleClose} />);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalled();
  });
});
