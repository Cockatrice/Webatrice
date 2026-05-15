import { vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';
import AddUserForm from './AddUserForm';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('AddUserForm', () => {
  it('renders the supplied label and an Add button', () => {
    renderWithProviders(<AddUserForm label="Add to Buddies" onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    // MUI renders the label twice (visible label + notched-outline legend).
    expect(screen.getAllByText('Add to Buddies').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('submits the typed user name and then resets the field', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<AddUserForm label="Add to Ignore" onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });

    const input = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'someUser' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Add' }).closest('form')!);
    });
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({ userName: 'someUser' });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe('');
    });
  });
});
