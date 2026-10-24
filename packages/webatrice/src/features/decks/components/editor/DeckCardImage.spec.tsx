import { fireEvent, render, screen } from '@testing-library/react';

import { DeckCardImage } from './DeckCardImage';

it('preserves the sized placeholder across preview changes and reveals only loaded art', () => {
  const view = (urls: string[]) => (
    <DeckCardImage urls={urls} alt="Card" className="aspect-[5/7] w-full">Placeholder</DeckCardImage>
  );
  const { rerender } = render(view(['a']));
  const image = screen.getByAltText('Card');
  const frame = image.parentElement;
  expect(frame).toHaveClass('aspect-[5/7]');
  expect(screen.queryByText('Placeholder')).toBeNull();
  expect(frame?.textContent).toBe('');
  expect(image).toHaveStyle({ opacity: '0' });
  fireEvent.load(image);
  expect(image).toHaveStyle({ opacity: '1' });
  expect(screen.queryByText('Placeholder')).toBeNull();
  rerender(view(['b', 'c']));
  expect(image).toHaveAttribute('src', 'b');
  expect(image).toHaveStyle({ opacity: '0' });
  expect(image.parentElement).toBe(frame);
  expect(screen.queryByText('Placeholder')).toBeNull();
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', 'c');
  expect(image).toHaveStyle({ opacity: '0' });
  fireEvent.load(image);
  expect(image).toHaveStyle({ opacity: '1' });
});


it('shows fallback children for missing URLs and after all candidates fail', () => {
  const view = (urls: string[]) => <DeckCardImage urls={urls} alt="Card">Unavailable</DeckCardImage>;
  const { rerender } = render(view([]));
  expect(screen.getByText('Unavailable')).toBeVisible();
  rerender(view(['a', 'b']));
  expect(screen.queryByText('Unavailable')).toBeNull();
  const image = screen.getByAltText('Card');
  fireEvent.error(image);
  expect(screen.queryByText('Unavailable')).toBeNull();
  fireEvent.error(image);
  expect(screen.getByText('Unavailable')).toBeVisible();
  expect(screen.queryByAltText('Card')).toBeNull();
});
