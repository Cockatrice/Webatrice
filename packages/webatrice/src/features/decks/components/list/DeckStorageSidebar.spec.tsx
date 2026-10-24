import { fireEvent, render, screen, within } from '@testing-library/react';

import type { DeckFolderNode } from '../../deckFolders';
import { DeckStorageSidebar, type DeckStorageSidebarProps } from './DeckStorageSidebar';

const folders: DeckFolderNode[] = [
  { name: 'Commander', path: 'Commander', deckCount: 3, visibility: 'private', children: [
    { name: 'Testing', path: 'Commander/Testing', deckCount: 2, visibility: 'private', children: [] },
  ] },
  { name: 'Modern', path: 'Modern', deckCount: 1, visibility: 'private', children: [] },
];

function setup(patch: Partial<DeckStorageSidebarProps> = {}) {
  const props: DeckStorageSidebarProps = {
    loading: false, deckTotal: 5, folders, activePath: '', isConnected: true,
    onSelect: vi.fn(), onCreate: vi.fn(), onImport: vi.fn(), onMigrate: vi.fn(), onNewFolder: vi.fn(), ...patch,
  };
  render(<DeckStorageSidebar {...props} />);
  return props;
}

it('shows the folder tree with counts and marks the open folder', () => {
  const props = setup({ activePath: 'Commander/Testing' });
  const tree = screen.getByRole('navigation', { name: 'DeckStorageSidebar.folders' });
  expect(within(tree).getByRole('button', { name: /^DeckStorageSidebar.allDecks/ })).toHaveTextContent('5');
  expect(within(tree).getByRole('button', { name: /^Testing/ })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(within(tree).getByRole('button', { name: /^Modern/ }));
  expect(props.onSelect).toHaveBeenCalledWith('Modern');
  expect(within(tree).queryByRole('button', { name: 'DeckStorageSidebar.collapse' })).toBeNull();
});

it('collapses a branch that does not hold the open folder', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageSidebar.collapse' }));
  expect(screen.queryByRole('button', { name: /^Testing/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'DeckStorageSidebar.expand' }));
  expect(screen.getByRole('button', { name: /^Testing/ })).toBeInTheDocument();
});

it('creates, imports from desktop or a list, and adds folders', () => {
  const props = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Decks.list.newDeck' }));
  fireEvent.click(screen.getByRole('button', { name: 'ImportMenu.import' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'ImportMenu.fromCockatrice' }));
  fireEvent.click(screen.getByRole('button', { name: 'ImportMenu.import' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'ImportMenu.pasteOrOpen' }));
  fireEvent.click(screen.getByRole('button', { name: 'DeckFolders.newFolder' }));
  expect(props.onCreate).toHaveBeenCalledOnce();
  expect(props.onMigrate).toHaveBeenCalledOnce();
  expect(props.onImport).toHaveBeenCalledOnce();
  expect(props.onNewFolder).toHaveBeenCalledOnce();
});

it('disables storage actions while disconnected', () => {
  setup({ isConnected: false });
  expect(screen.getByRole('button', { name: 'Decks.list.newDeck' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'ImportMenu.import' }));
  expect(screen.getByRole('menuitem', { name: /ImportMenu.pasteOrOpen/ })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('button', { name: 'DeckFolders.newFolder' })).toBeDisabled();
});

it('shows the sharing section only with sharing actions', () => {
  setup();
  expect(screen.queryByRole('navigation', { name: 'DeckStorageSidebar.sharing' })).toBeNull();
});

it('opens public decks, share links and shared decks', () => {
  const onPublicDecks = vi.fn();
  const onShareLinks = vi.fn();
  setup({ onPublicDecks, onShareLinks, publicDeckCount: 2 });
  const sharing = screen.getByRole('navigation', { name: 'DeckStorageSidebar.sharing' });
  fireEvent.click(within(sharing).getByRole('button', { name: /DeckStorageSidebar.publicDecks/ }));
  fireEvent.click(within(sharing).getByRole('button', { name: 'DeckShareLinks.open' }));
  expect(onPublicDecks).toHaveBeenCalledOnce();
  expect(onShareLinks).toHaveBeenCalledOnce();
  expect(within(sharing).queryByRole('button', { name: 'OpenShareLink.open' })).toBeNull();
});
