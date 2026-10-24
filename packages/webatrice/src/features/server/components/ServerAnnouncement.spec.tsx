import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../__test-utils__';
import ServerAnnouncement from './ServerAnnouncement';

function stubHeights({ content, viewport }: { content: number; viewport: number }) {
  const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');
  const client = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => content });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => viewport });
  return () => {
    if (scroll) {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', scroll);
    }
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
    if (client) {
      Object.defineProperty(Element.prototype, 'clientHeight', client);
    }
  };
}

describe('ServerAnnouncement', () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it('shows a message that fits in full, with no toggle', () => {
    restore = stubHeights({ content: 200, viewport: 200 });
    renderWithProviders(<ServerAnnouncement message="<b>Welcome</b>" />);
    expect(screen.getByText('Welcome')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ServerAnnouncement.showMore' })).not.toBeInTheDocument();
  });

  it('offers Show more when the message is cut off and Show less once expanded', () => {
    restore = stubHeights({ content: 900, viewport: 300 });
    renderWithProviders(<ServerAnnouncement message="<b>Welcome</b>" />);
    const body = screen.getByText('Welcome').parentElement as HTMLElement;

    const more = screen.getByRole('button', { name: 'ServerAnnouncement.showMore' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', body.id);
    fireEvent.click(more);

    expect(screen.getByRole('button', { name: 'ServerAnnouncement.showLess' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('says so when the server sends no message', () => {
    renderWithProviders(<ServerAnnouncement message={null} />);
    expect(screen.getByText('ServerAnnouncement.empty')).toBeInTheDocument();
  });
});
