import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import Messages from './Messages';

describe('Messages', () => {
  it('renders an empty container when no messages are provided', () => {
    const { container } = renderWithProviders(<Messages />);

    expect(container.querySelector('.messages')).toBeInTheDocument();
    expect(container.querySelectorAll('.message-wrapper')).toHaveLength(0);
  });

  it('renders one wrapper per message', () => {
    const messages = [
      { message: 'first', timeReceived: 1 },
      { message: 'second', timeReceived: 2 },
    ] as never;

    const { container } = renderWithProviders(<Messages messages={messages} />);

    expect(container.querySelectorAll('.message-wrapper')).toHaveLength(2);
    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });
});
