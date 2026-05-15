import { act, fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import SayMessage from './SayMessage';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('SayMessage', () => {
  it('renders the chat input and the send button', () => {
    renderWithProviders(<SayMessage onSubmit={vi.fn()} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('submits the typed message and clears the field', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<SayMessage onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'hello room' } });
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Send' }).closest('form')!);
    });
    await flush();

    expect(onSubmit).toHaveBeenCalledWith({ message: 'hello room' });
    expect(input.value).toBe('');
  });
});
