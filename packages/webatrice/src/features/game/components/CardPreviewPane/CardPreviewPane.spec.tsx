import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { CardPreviewProvider, createCardPreviewStore } from '../ui/CardPreviewContext';
import CardPreviewPane from './CardPreviewPane';

vi.mock('../CardPreviewPopup/useCardPreviewPopup', () => ({
  useCardPreviewPopup: () => ({ isOpen: false, toggle: vi.fn() }),
}));

const ID = '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

function hover(card: { name: string; scryfallId?: string }) {
  const store = createCardPreviewStore();
  const { container } = render(
    <CardPreviewProvider store={store}>
      <CardPreviewPane />
    </CardPreviewProvider>,
  );
  act(() => store.setHoveredCard(card));
  return container.querySelector('img[src*="scryfall"]')?.getAttribute('src');
}

describe('CardPreviewPane', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('previews the hovered printing by Scryfall id', () => {
    expect(hover({ name: 'Rhino, Warrior Token', scryfallId: ID }))
      .toBe(`https://api.scryfall.com/cards/${ID}?format=image&version=png`);
  });

  it('previews a name-only card by its exact name', () => {
    expect(hover({ name: 'Rhino, Warrior Token' }))
      .toBe('https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior%20Token&format=image&version=png');
  });

  it('is a labelled region offering the desktop Image, Description and Both views', () => {
    render(
      <CardPreviewProvider store={createCardPreviewStore()}>
        <CardPreviewPane />
      </CardPreviewProvider>,
    );
    expect(screen.getByRole('region', { name: 'CardPreviewPane.label' })).toBeInTheDocument();
    const modes = screen.getByRole('radiogroup', { name: 'CardPreviewPane.modes' });
    expect(within(modes).getByRole('radio', { name: 'CardPreviewPane.modeImage' })).toBeChecked();
    fireEvent.click(within(modes).getByRole('radio', { name: 'CardPreviewPane.modeBoth' }));
    expect(within(modes).getByRole('radio', { name: 'CardPreviewPane.modeBoth' })).toBeChecked();
    expect(window.localStorage.getItem('webatrice.cardPreviewMode')).toBe('both');
    expect(screen.getAllByText('CardPreviewPane.hoverToPreview').length).toBeGreaterThan(0);
  });

  it('hides and shows the card info, remembering the choice', () => {
    window.localStorage.removeItem('webatrice.cardPreviewHidden');
    render(
      <CardPreviewProvider store={createCardPreviewStore()}>
        <CardPreviewPane />
      </CardPreviewProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'CardPreviewPane.hide' }));
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText('CardPreviewPane.hoverToPreview')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('webatrice.cardPreviewHidden')).toBe('1');
    const show = screen.getByRole('button', { name: 'CardPreviewPane.show' });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(show);
    expect(screen.getByRole('radiogroup', { name: 'CardPreviewPane.modes' })).toBeInTheDocument();
    window.localStorage.removeItem('webatrice.cardPreviewHidden');
    window.localStorage.removeItem('webatrice.cardPreviewMode');
  });
});
