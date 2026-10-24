import { act, render } from '@testing-library/react';

import { CardPreviewProvider, createCardPreviewStore } from '../CardPreviewContext';
import { BigCardPreview } from './BigCardPreview';

const ID = '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

function renderOpenOn(card: { name: string; scryfallId?: string }) {
  const store = createCardPreviewStore();
  render(
    <CardPreviewProvider store={store}>
      <BigCardPreview />
    </CardPreviewProvider>,
  );
  act(() => store.openBigPreview(card));
  return document.body.querySelector('img')?.getAttribute('src');
}

describe('BigCardPreview image', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zooms the chosen printing by Scryfall id', () => {
    expect(renderOpenOn({ name: 'Rhino, Warrior Token', scryfallId: ID }))
      .toBe(`https://api.scryfall.com/cards/${ID}?format=image&version=large`);
  });

  it('zooms a name-only card by its name without the Token suffix', () => {
    expect(renderOpenOn({ name: 'Rhino, Warrior Token' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior&format=image&version=large');
  });
});
