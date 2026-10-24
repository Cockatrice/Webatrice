import { act, render } from '@testing-library/react';

import type { CardPreviewMessage } from './cardPreviewChannel';
import CardPreviewPopupPage from './CardPreviewPopupPage';

const channel = vi.hoisted(() => ({ handler: null as ((msg: CardPreviewMessage) => void) | null }));

vi.mock('./cardPreviewChannel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./cardPreviewChannel')>()),
  postCardPreviewMessage: vi.fn(),
  subscribeToCardPreviewChannel: (handler: (msg: CardPreviewMessage) => void) => {
    channel.handler = handler;
    return () => {};
  },
}));

const ID = '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

function showCard(card: { name: string; scryfallId?: string }) {
  const { container } = render(<CardPreviewPopupPage />);
  act(() => channel.handler?.({ kind: 'card', card }));
  return container.querySelector('img[src*="scryfall"]')?.getAttribute('src');
}

describe('CardPreviewPopupPage image', () => {
  it('shows the chosen printing by Scryfall id', () => {
    expect(showCard({ name: 'Rhino, Warrior Token', scryfallId: ID }))
      .toBe(`https://api.scryfall.com/cards/${ID}?format=image&version=png`);
  });

  it('shows a name-only card by its exact name', () => {
    expect(showCard({ name: 'Rhino, Warrior Token' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior%20Token&format=image&version=png');
  });
});
