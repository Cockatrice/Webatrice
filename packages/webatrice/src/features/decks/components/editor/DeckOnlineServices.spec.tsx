import { fireEvent, render, screen } from '@testing-library/react';

import { Menu } from '@app/components';

import { openInNewTab, printHtml, submitFormInNewTab } from '../../browserHandoff';
import type { HydratedDeck } from '../../types';
import { DeckOnlineServiceItems } from './DeckOnlineServices';

vi.mock('../../browserHandoff', () => ({
  openInNewTab: vi.fn(),
  printHtml: vi.fn(),
  submitFormInNewTab: vi.fn(),
}));

const deck: HydratedDeck = {
  name: 'Burn',
  meta: { v: 1, updatedAt: 'x' },
  format: 'modern',
  cards: [{ name: 'Lightning Bolt', quantity: 4, category: 'main', lookupSource: 'scryfall' }],
};

function renderServices(d: HydratedDeck = deck) {
  render(
    <Menu anchor={{ x: 0, y: 0 }} label="More" onClose={vi.fn()}>
      <DeckOnlineServiceItems deck={d} />
    </Menu>,
  );
}

function openSendTo() {
  fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.sendTo' }));
}

describe('DeckOnlineServiceItems', () => {
  it('prints the deck', () => {
    renderServices();
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.print' }));
    expect(vi.mocked(printHtml).mock.calls[0][0]).toContain('<h1>Burn</h1>');
  });

  it('opens decklist.org / decklist.xyz with the deck in the URL', () => {
    renderServices();
    openSendTo();
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.decklistOrg' }));
    openSendTo();
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.decklistXyz' }));
    expect(vi.mocked(openInNewTab).mock.calls.map(([url]) => new URL(url).host)).toEqual(['www.decklist.org', 'www.decklist.xyz']);
  });

  it('posts the deck to deckstats and TappedOut', () => {
    renderServices();
    openSendTo();
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.deckstats' }));
    openSendTo();
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckTools.tappedout' }));
    expect(vi.mocked(submitFormInNewTab).mock.calls.map(([form]) => form.action)).toEqual([
      'https://deckstats.net/index.php',
      'https://tappedout.net/mtg-decks/paste/',
    ]);
  });

  it('explains and disables the services for an empty deck', () => {
    renderServices({ ...deck, cards: [] });
    openSendTo();
    const item = screen.getByRole('menuitem', { name: 'DeckTools.decklistOrg' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAccessibleDescription('DeckTools.empty');
    fireEvent.click(item);
    expect(openInNewTab).not.toHaveBeenCalled();
  });
});
