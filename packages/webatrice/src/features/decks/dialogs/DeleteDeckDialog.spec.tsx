import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';

import { DeleteDeckDialog } from './DeleteDeckDialog';

describe('DeleteDeckDialog', () => {
  it('names the deck and confirms or cancels', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderWithProviders(<DeleteDeckDialog deckName="Burn" onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByRole('alertdialog', { name: 'DeleteDeckDialog.title' })).toHaveAccessibleDescription('DeleteDeckDialog.message');
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Common.action.cancel' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
