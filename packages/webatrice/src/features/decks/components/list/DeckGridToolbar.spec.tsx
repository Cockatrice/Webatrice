import { fireEvent, render, screen, within } from '@testing-library/react';

import { NO_DECK_FILTERS } from '../../deckGrid';
import type { DeckFolderEntry } from '../../deckFolders';
import type { UseDeckGrid } from '../../hooks/useDeckGrid';
import { DeckGridToolbar, type DeckGridToolbarProps } from './DeckGridToolbar';

function grid(patch: Partial<UseDeckGrid> = {}): UseDeckGrid {
  return {
    tiles: [], pending: 0, total: 0, filtered: false,
    options: { tags: ['ramp', 'tokens'], formats: ['commander'], brackets: [2, 3] },
    filters: NO_DECK_FILTERS, setFilters: vi.fn(), clearFilters: vi.fn(), sort: 'newest', setSort: vi.fn(), ...patch,
  };
}

const folder: DeckFolderEntry = {
  name: 'Cube', path: 'Cube', deckCount: 2, directDeckCount: 2, folderCount: 0, visibility: 'private',
};

function setup(patch: Partial<DeckGridToolbarProps> = {}) {
  const props: DeckGridToolbarProps = {
    title: 'All decks', deckCount: 2, folderCount: 1, folder: null, grid: grid(), isConnected: true,
    viewMode: 'card', onViewModeChange: vi.fn(), onRefresh: vi.fn(), ...patch,
  };
  render(<DeckGridToolbar {...props} />);
  return props;
}

it('drives search, colour, format, bracket and tag filters', () => {
  const props = setup();
  const { setFilters } = props.grid;
  fireEvent.change(screen.getByRole('searchbox', { name: 'DeckGridToolbar.search' }), { target: { value: 'elf' } });
  expect(setFilters).toHaveBeenLastCalledWith({ query: 'elf' });
  fireEvent.click(screen.getByRole('button', { name: 'DeckGridToolbar.colour.G' }));
  expect(setFilters).toHaveBeenLastCalledWith({ colours: ['G'] });
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckGridToolbar.colourMode' }), { target: { value: 'exactly' } });
  expect(setFilters).toHaveBeenLastCalledWith({ colourMode: 'exactly' });
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckGridToolbar.format' }), { target: { value: 'commander' } });
  expect(setFilters).toHaveBeenLastCalledWith({ format: 'commander' });
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckGridToolbar.bracket' }), { target: { value: '3' } });
  expect(setFilters).toHaveBeenLastCalledWith({ bracket: 3 });
  fireEvent.click(within(screen.getByRole('group', { name: 'DeckGridToolbar.tags' })).getByRole('button', { name: 'ramp' }));
  expect(setFilters).toHaveBeenLastCalledWith({ tags: ['ramp'] });
});

it('shows active filters as pressed, how many decks are still checked, and clears them', () => {
  const props = setup({ grid: grid({ filtered: true, pending: 2, filters: { ...NO_DECK_FILTERS, tags: ['ramp'], colours: ['U'] } }) });
  expect(screen.getByRole('button', { name: 'ramp' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'DeckGridToolbar.colour.U' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('DeckGridToolbar.pending');
  fireEvent.click(screen.getByRole('button', { name: 'DeckGridToolbar.clear' }));
  expect(props.grid.clearFilters).toHaveBeenCalledOnce();
});

it('sorts, switches view and refreshes', () => {
  const props = setup();
  fireEvent.change(screen.getByRole('combobox', { name: 'DeckGridToolbar.sort' }), { target: { value: 'nameAsc' } });
  expect(props.grid.setSort).toHaveBeenCalledWith('nameAsc');
  fireEvent.click(screen.getByRole('radio', { name: 'Decks.list.view.compact' }));
  expect(props.onViewModeChange).toHaveBeenCalledWith('compact');
  fireEvent.click(screen.getByRole('button', { name: 'Decks.list.refreshLabel' }));
  expect(props.onRefresh).toHaveBeenCalledOnce();
});

it('offers folder actions only for a folder', () => {
  const onDelete = vi.fn();
  setup({ folder, folderActions: { onNewFolder: vi.fn(), onDownload: vi.fn(), onDelete } });
  fireEvent.click(screen.getByRole('button', { name: 'DeckGridToolbar.folderActions' }));
  expect(screen.queryByRole('menuitem', { name: 'DeckGridToolbar.shareFolder' })).toBeNull();
  fireEvent.click(screen.getByRole('menuitem', { name: 'DeckFolders.deleteFolder' }));
  expect(onDelete).toHaveBeenCalledOnce();
});

it('has no folder actions at the root', () => {
  setup();
  expect(screen.queryByRole('button', { name: 'DeckGridToolbar.folderActions' })).toBeNull();
});
