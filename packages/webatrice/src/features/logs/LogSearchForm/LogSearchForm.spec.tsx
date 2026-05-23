import { vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders, disconnectedState } from '../../../__test-utils__';
import LogSearchForm from './LogSearchForm';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('LogSearchForm', () => {
  it('renders all input fields and the search button', () => {
    renderWithProviders(<LogSearchForm onSubmit={vi.fn()} />, {
      preloadedState: disconnectedState,
    });
    // Five text inputs + three checkboxes.
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /LogSearchForm\.button\.search/ })).toBeInTheDocument();
  });

  it('submits the form values to the onSubmit handler', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<LogSearchForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });

    const [userNameInput] = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(userNameInput, { target: { value: 'searchUser' } });
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }).closest('form')!,
      );
    });
    await flush();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].userName).toBe('searchUser');
  });

  it('reflects checkbox state in the submitted values', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<LogSearchForm onSubmit={onSubmit} />, {
      preloadedState: disconnectedState,
    });

    const [roomCheckbox] = screen.getAllByRole('checkbox');
    await act(async () => {
      fireEvent.click(roomCheckbox);
    });
    await act(async () => {
      fireEvent.submit(
        screen.getByRole('button', { name: /LogSearchForm\.button\.search/ }).closest('form')!,
      );
    });
    await flush();

    expect(onSubmit.mock.calls[0][0].logLocation.room).toBe(true);
  });
});
