import { fireEvent, render, screen, within } from '@testing-library/react';

import { deckTileView } from '../../deckGrid';
import type { FlatDeck } from '../../deckTree';
import type { DeckActions } from './DeckActionsMenu';
import { DeckListRow, DeckTile } from './DeckTile';

const deck: FlatDeck = {
  id: 7, name: 'Atraxa', path: 'Commander', creationTime: 0, visibility: 'public', colorIdentity: 'WUBG', tags: ['Walkers'],
};
const view = deckTileView(deck, { format: 'commander', bracketLevel: 3, usd: 12.5, cardCount: 100, bannerCard: 'Atraxa' });

function actions(patch: Partial<DeckActions> = {}): DeckActions {
  return {
    onOpen: vi.fn(), onEdit: vi.fn(), onShare: vi.fn(), onTogglePublic: vi.fn(), onMove: vi.fn(), onDownload: vi.fn(),
    onDelete: vi.fn(), ...patch,
  };
}

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'DeckActionsMenu.more' }));
  return screen.getByRole('menu', { name: 'DeckActionsMenu.label' });
}

describe.each([['tile', DeckTile], ['row', DeckListRow]] as const)('Deck%s', (_kind, Item) => {
  it('shows what the store knows about the deck and opens it', () => {
    const a = actions();
    render(<Item view={view} actions={a} />);
    const article = screen.getByRole('article', { name: 'Atraxa' });
    expect(within(article).getByText('Decks.badge.bracketShort')).toBeInTheDocument();
    expect(within(article).getByRole('img', { name: 'Decks.badge.identity' }).children).toHaveLength(4);
    expect(within(article).getByText('DeckSharing.public')).toBeInTheDocument();
    expect(within(article).getByTitle('Decks.badge.priceTotal')).toHaveTextContent(/12.50/);
    fireEvent.click(screen.getByRole('button', { name: 'DeckTile.open' }));
    expect(a.onOpen).toHaveBeenCalledOnce();
  });

  it('prefetches the editor on pointer enter and focus', () => {
    const onPrefetch = vi.fn();
    render(<Item view={view} actions={actions()} onPrefetch={onPrefetch} />);
    const article = screen.getByRole('article', { name: 'Atraxa' });
    fireEvent.pointerEnter(article);
    fireEvent.focus(within(article).getByRole('button', { name: 'DeckTile.open' }));
    expect(onPrefetch).toHaveBeenCalledTimes(2);
  });

  it('offers every action from a visible menu button', () => {
    const a = actions();
    render(<Item view={view} actions={a} />);
    const menu = openMenu();
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'DeckActionsMenu.open', 'DeckActionsMenu.share', 'DeckActionsMenu.makePrivate', 'DeckActionsMenu.editTags',
      'DeckActionsMenu.setBanner', 'DeckActionsMenu.rename', 'DeckActionsMenu.move', 'DeckActionsMenu.download',
      'DeckActionsMenu.delete',
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'DeckActionsMenu.rename' }));
    expect(a.onEdit).toHaveBeenCalledWith('rename');
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(within(openMenu()).getByRole('menuitem', { name: 'DeckActionsMenu.delete' }));
    expect(a.onDelete).toHaveBeenCalledOnce();
  });
});

it('leaves out sharing and moving when unavailable and explains disabled edits', () => {
  const a = actions({ onShare: undefined, onTogglePublic: undefined, onMove: undefined, editDisabledReason: 'Loading' });
  render(<DeckTile view={deckTileView({ ...deck, visibility: 'private' }, undefined)} actions={a} />);
  const menu = openMenu();
  expect(within(menu).queryByRole('menuitem', { name: 'DeckActionsMenu.share' })).toBeNull();
  expect(within(menu).queryByRole('menuitem', { name: 'DeckActionsMenu.move' })).toBeNull();
  const rename = within(menu).getByRole('menuitem', { name: 'DeckActionsMenu.rename' });
  expect(rename).toHaveAttribute('aria-disabled', 'true');
  fireEvent.click(rename);
  expect(a.onEdit).not.toHaveBeenCalled();
});

it('shows a loading price and no identity before anything is known', () => {
  render(<DeckTile view={deckTileView({ ...deck, colorIdentity: undefined }, undefined)} actions={actions()} />);
  expect(screen.getByTitle('Decks.badge.priceLoading')).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Decks.badge.identity' })).toBeNull();
});

it('shows no identity pips for a colourless deck', () => {
  render(<DeckTile view={deckTileView({ ...deck, colorIdentity: '' }, undefined)} actions={actions()} />);
  expect(screen.queryByRole('img', { name: 'Decks.badge.identity' })).toBeNull();
});
