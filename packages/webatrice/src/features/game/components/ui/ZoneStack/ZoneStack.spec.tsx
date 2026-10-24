import { act, fireEvent, screen } from '@testing-library/react';
import { makeCard } from '@cockatrice/datatrice/testing';
import { testI18n } from '../../../../../__test-utils__/renderWithProviders';

import {
  chooseMenuPath,
  menuLabels,
  openContextMenu,
  openMenus,
  pileEl,
  renderSeatCell,
  type SeatGameSpec,
} from '../../../__test-utils__/seatFixtures';

vi.mock('../../../../../services/cards/catalog/lookup', async () =>
  (await import('../../../__test-utils__/unknownCardCatalog')).unknownCardCatalog());

const SPEC: SeatGameSpec = {
  localPlayerId: 1,
  seats: [
    { playerId: 1, deckCount: 40, grave: [makeCard({ id: 40, name: 'Duress' }), makeCard({ id: 41, name: 'Opt' })], exile: [] },
    { playerId: 2, deckCount: 33, grave: [] },
  ],
};

describe('ZoneStack', () => {
  it('updates the pile name and count when the UI language changes', async () => {
    renderSeatCell(SPEC);
    testI18n.addResourceBundle('fr', 'translation', {
      ZoneStack: {
        library: 'Bibliothèque',
        pile: '{zone}, {count, plural, one {# carte} other {# cartes}}',
      },
    });
    try {
      await act(async () => {
        await testI18n.changeLanguage('fr');
      });
      const library = screen.getByRole('button', { name: 'Bibliothèque, 40 cartes' });
      expect(library).toHaveAttribute('title', 'Bibliothèque, 40 cartes');
    } finally {
      await act(async () => {
        await testI18n.changeLanguage('en-US');
      });
      testI18n.removeResourceBundle('fr', 'translation');
    }
    expect(screen.getByRole('button', { name: 'Library, 40 cards' })).toHaveAttribute('title', 'Library, 40 cards');
  });

  it('draws the library, graveyard and exile piles with their counts and top card', () => {
    renderSeatCell(SPEC);
    expect(pileEl('Library')).toHaveAttribute('title', 'Library, 40 cards');
    expect(pileEl('Graveyard')).toHaveAttribute('title', 'Graveyard, 2 cards, top: Opt');
    expect(pileEl('Exile')).toHaveAttribute('title', 'Exile, 0 cards');
    expect(pileEl('Library')).toHaveAttribute('data-pile-count', '40');
    expect(pileEl('Graveyard')).toHaveAttribute('data-pile-count', '2');
    expect(pileEl('Exile')).toHaveAttribute('data-pile-count', '0');
  });

  it('gives the owner the library menu, and its first item draws', () => {
    const { game } = renderSeatCell(SPEC);
    expect(menuLabels(openContextMenu(pileEl('Library'))).slice(0, 3)).toEqual(['Draw card', 'Draw cards...', 'Undo last draw']);
    chooseMenuPath('Draw card');
    expect(game.drawCards).toHaveBeenCalledWith(1, { number: 1 });
  });

  it('gives the owner the graveyard menu and another viewer only its view', () => {
    renderSeatCell(SPEC);
    expect(menuLabels(openContextMenu(pileEl('Graveyard')))).toEqual(
      expect.arrayContaining(['View graveyard', 'Reveal random card to...', 'Move graveyard to...']),
    );
  });

  it('opens no menu on another player\'s library, and only views on their piles', () => {
    renderSeatCell(SPEC, 2);
    fireEvent.contextMenu(pileEl('Library'));
    expect(openMenus()).toEqual([]);
    expect(menuLabels(openContextMenu(pileEl('Exile')))).toEqual(['View exile (disabled)']);
  });

  it('makes each pile a menu button named by its zone, count and top card', () => {
    renderSeatCell(SPEC);
    expect(screen.getByRole('button', { name: 'Graveyard, 2 cards, top: Opt' })).toBe(pileEl('Graveyard'));
    expect(screen.getByRole('button', { name: 'Library, 40 cards' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.getByRole('button', { name: 'Exile, 0 cards' })).toHaveAttribute('tabindex', '0');
  });

  it('shows another player\'s library, which opens no menu, as a labelled picture out of the tab order', () => {
    renderSeatCell(SPEC, 2);
    expect(screen.getByRole('img', { name: 'Library, 33 cards' })).not.toHaveAttribute('tabindex');
  });

  it.each(['Enter', ' ', 'ContextMenu'])('opens the pile menu from the keyboard (%j) and hands focus back on Escape', (key) => {
    renderSeatCell(SPEC);
    const grave = pileEl('Graveyard');
    act(() => grave.focus());
    act(() => {
      fireEvent.keyDown(grave, { key });
    });
    const [menu] = openMenus();
    expect(menu).toHaveAccessibleName('Graveyard');
    expect(grave).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toContainElement(document.activeElement as HTMLElement);
    act(() => {
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    });
    expect(openMenus()).toEqual([]);
    expect(grave).toHaveFocus();
  });

  it('draws a pile\'s top card from its printing, else from its exact name', () => {
    renderSeatCell({
      localPlayerId: 1,
      seats: [{
        playerId: 1,
        deckCount: 40,
        grave: [makeCard({ id: 40, name: 'Rhino, Warrior Token', providerId: '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b' })],
        exile: [makeCard({ id: 41, name: 'Rhino, Warrior Token' })],
      }],
    });
    expect(pileEl('Graveyard').querySelector('img')).toHaveAttribute(
      'src',
      'https://api.scryfall.com/cards/0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b?format=image&version=large',
    );
    expect(pileEl('Exile').querySelector('img')).toHaveAttribute(
      'src',
      'https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior%20Token&format=image&version=large',
    );
  });
});
