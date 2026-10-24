import { fireEvent, render, screen } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({ useCardImageUrls: vi.fn<() => string[]>() }));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  useCardImageUrls: hoisted.useCardImageUrls,
}));

import type { CardDTO } from '@app/services';
import Card from './Card';

const card = { name: { value: 'Lightning Bolt' }, set: { value: 'M10' } } as CardDTO;

describe('Card', () => {
  it('renders nothing without a card', () => {
    hoisted.useCardImageUrls.mockReturnValue([]);
    const { container } = render(<Card card={undefined as unknown as CardDTO} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the first candidate and falls through to the next on a load error', () => {
    hoisted.useCardImageUrls.mockReturnValue(['https://first/bolt.jpg', 'https://second/bolt.jpg']);
    render(<Card card={card} />);

    const img = screen.getByRole('img', { name: 'Lightning Bolt' });
    expect(img).toHaveAttribute('src', 'https://first/bolt.jpg');

    fireEvent.error(img);
    expect(img).toHaveAttribute('src', 'https://second/bolt.jpg');
  });
});
