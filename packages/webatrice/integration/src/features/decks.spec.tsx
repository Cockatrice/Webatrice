import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { Decks, clearDeckEditorCache, clearDecksListCache } from '@app/features/decks';
import { dexieService, parseCod } from '@app/services';
import { RouteEnum } from '@app/types';
import {
  Command_DeckDel_ext,
  Command_DeckDelDir_ext,
  Command_DeckList_ext,
  Command_DeckNewDir_ext,
  Command_DeckUpload_ext,
  Command_DeckUploadSchema,
  Response_DeckUploadSchema,
  Response_DeckUpload_ext,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';
import { create, isFieldSet } from '@bufbuild/protobuf';

import { connectAndLogin } from '../helpers/setup';
import { findAllSessionCommands, findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen, store } from './helpers';
import {
  LocationProbe,
  codXml,
  deckFile,
  deckFolder,
  respondToDeckDownload,
  respondToDeckList,
  sentDeckDownloadIds,
  stubThirdPartyFetch,
} from './deckHelpers';

function renderDecks() {
  return renderFeatureScreen(
    <Routes>
      <Route path={RouteEnum.DECKS} element={<Decks />} />
      <Route path={RouteEnum.DECK} element={<LocationProbe />} />
    </Routes>,
    RouteEnum.DECKS,
  );
}

const NOW_SECONDS = Math.floor(Date.now() / 1000);

beforeEach(async () => {
  vi.useRealTimers();
  await dexieService.deckSummaries.clear();
  clearDecksListCache();
  clearDeckEditorCache();
  window.localStorage.clear();
  stubThirdPartyFetch();
  connectAndLogin();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function loadTree(items = [
  deckFile(1, 'Older Deck', NOW_SECONDS - 7200),
  deckFile(2, 'Newer Deck', NOW_SECONDS - 60),
]) {
  renderDecks();
  await waitFor(() => expect(findAllSessionCommands(Command_DeckList_ext).length).toBeGreaterThan(0));
  act(() => {
    respondToDeckList(items);
  });
}

const NESTED_TREE = [
  deckFile(1, 'Older Deck', NOW_SECONDS - 7200),
  deckFolder('Tournament', [
    deckFile(2, 'Newer Deck', NOW_SECONDS - 60),
    deckFolder('Old', [deckFile(3, 'Oldest Deck', NOW_SECONDS - 86400 * 3)]),
  ]),
];

function tile(name: string) {
  return screen.getByRole('article', { name });
}

function deckAction(deckName: string, item: string) {
  fireEvent.click(within(tile(deckName)).getByRole('button', { name: 'DeckActionsMenu.more' }));
  fireEvent.click(screen.getByRole('menuitem', { name: item }));
}

function folderTree() {
  return screen.getByRole('navigation', { name: 'DeckStorageSidebar.folders' });
}

function openFolder(name: string) {
  fireEvent.click(within(folderTree()).getByRole('button', { name: new RegExp(`^${name}`) }));
}

function downloadsOf(id: number) {
  return sentDeckDownloadIds().filter((sent) => sent === id).length;
}

function acknowledge(cmdId: number) {
  act(() => {
    deliverMessage(buildResponseMessage(buildResponse({ cmdId })));
  });
}

describe('Decks (integration)', () => {
  it('renders the My Decks heading when the user is connected', () => {
    renderDecks();
    expect(screen.getByRole('heading', { level: 1, name: 'Decks.list.title' })).toBeInTheDocument();
    expect(screen.getByText('Decks.list.loading')).toBeInTheDocument();
  });

  it('requests the deck tree and lists the decks at the root, newest first', async () => {
    await loadTree();

    expect(await screen.findByText('DeckStorageSidebar.subtitle')).toBeInTheDocument();
    const names = screen.getAllByText(/^(Older|Newer) Deck$/).map((el) => el.textContent);
    expect(names).toEqual(['Newer Deck', 'Older Deck']);
    expect(screen.getAllByText('Decks.list.created')).toHaveLength(2);
  });

  describe('folders (desktop TabDeckStorage remote tree)', () => {
    it('keeps the hierarchy: the folder tree opens a folder with the decks under it, All decks goes back up', async () => {
      await loadTree(NESTED_TREE);

      expect(await screen.findByText('DeckStorageSidebar.subtitle')).toBeInTheDocument();
      expect(tile('Older Deck')).toBeInTheDocument();
      expect(tile('Oldest Deck')).toBeInTheDocument();
      expect(within(folderTree()).getByRole('button', { name: /^Old\s?\d/ })).toBeInTheDocument();
      await waitFor(() => expect(sentDeckDownloadIds().sort()).toEqual([1, 2, 3]));

      openFolder('Tournament');
      expect(await screen.findByRole('heading', { level: 2, name: 'Tournament' })).toBeInTheDocument();
      expect(tile('Newer Deck')).toBeInTheDocument();
      expect(tile('Oldest Deck')).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'Older Deck' })).toBeNull();
      expect(sentDeckDownloadIds()).toHaveLength(3);

      openFolder('DeckStorageSidebar.allDecks');
      expect(await screen.findByRole('article', { name: 'Older Deck' })).toBeInTheDocument();
    });

    it('creates a folder inside the shown folder with Command_DeckNewDir', async () => {
      await loadTree(NESTED_TREE);
      fireEvent.click(await screen.findByText('Tournament'));

      fireEvent.click(screen.getByRole('button', { name: /DeckFolders.newFolder/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'CreateFolder.label' }), { target: { value: 'Side/Plans' } });
      fireEvent.click(screen.getByRole('button', { name: /CreateFolder.create/ }));

      await waitFor(() => expect(findAllSessionCommands(Command_DeckNewDir_ext)).toHaveLength(1));
      const { cmdId, value } = findLastSessionCommand(Command_DeckNewDir_ext);
      expect([value.path, value.dirName]).toEqual(['Tournament', 'Side-Plans']);
      acknowledge(cmdId);
      expect(await screen.findByText('Side-Plans')).toBeInTheDocument();
    });

    it('deletes a folder after naming what goes with it, through Command_DeckDelDir', async () => {
      await loadTree(NESTED_TREE);

      openFolder('Tournament');
      fireEvent.click(await screen.findByRole('button', { name: 'DeckGridToolbar.folderActions' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'DeckFolders.deleteFolder' }));
      const dialog = screen.getByRole('alertdialog', { name: 'DeleteFolder.title' });
      expect(within(dialog).getByText('DeleteFolder.scope')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'DeleteFolder.delete' }));

      const { cmdId, value } = findLastSessionCommand(Command_DeckDelDir_ext);
      expect(value.path).toBe('Tournament');
      acknowledge(cmdId);
      await waitFor(() => expect(within(folderTree()).queryByRole('button', { name: /^Tournament/ })).toBeNull());
      expect(screen.getByRole('heading', { level: 2, name: 'DeckStorageSidebar.allDecks' })).toBeInTheDocument();
      expect(tile('Older Deck')).toBeInTheDocument();
      expect(screen.queryByRole('article', { name: 'Newer Deck' })).toBeNull();
    });

    it('creates a deck inside the shown folder', async () => {
      await loadTree(NESTED_TREE);
      fireEvent.click(await screen.findByText('Tournament'));

      fireEvent.click(screen.getAllByRole('button', { name: /Decks\.list\.newDeck/ })[0]);
      fireEvent.change(screen.getByPlaceholderText('CreateDeckDialog.namePlaceholder'), { target: { value: 'Side Brew' } });
      fireEvent.click(screen.getByRole('button', { name: 'Common.action.create' }));

      const { cmdId, value } = findLastSessionCommand(Command_DeckUpload_ext);
      expect(value.path).toBe('Tournament');
      act(() => {
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId,
          ext: Response_DeckUpload_ext,
          value: create(Response_DeckUploadSchema, {
            newFile: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 9, name: 'Side Brew' }),
          }),
        })));
      });
      expect(await screen.findByTestId('location')).toHaveTextContent('/deck/9');
    });

    it('moves a deck: uploads the copy into the target folder, then deletes the original', async () => {
      await loadTree(NESTED_TREE);
      const xml = codXml({ name: 'Older Deck', format: 'modern' });
      await waitFor(() => expect(sentDeckDownloadIds().sort()).toEqual([1, 2, 3]));
      act(() => {
        respondToDeckDownload(1, xml);
      });

      deckAction('Older Deck', 'DeckActionsMenu.move');
      fireEvent.change(screen.getByRole('combobox', { name: 'MoveDeck.target' }), { target: { value: 'Tournament/Old' } });
      const listRequestsBefore = findAllSessionCommands(Command_DeckList_ext).length;
      fireEvent.click(screen.getByRole('button', { name: /MoveDeck.move/ }));

      await waitFor(() => expect(findAllSessionCommands(Command_DeckList_ext)).toHaveLength(listRequestsBefore + 1));
      expect(downloadsOf(1)).toBe(1);
      expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(0);
      act(() => {
        respondToDeckList(NESTED_TREE);
      });
      await waitFor(() => expect(downloadsOf(1)).toBe(2));
      expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(0);
      act(() => {
        respondToDeckDownload(1, xml);
      });

      const upload = findLastSessionCommand(Command_DeckUpload_ext);
      expect([upload.value.path, upload.value.deckId, upload.value.deckList]).toEqual(['Tournament/Old', 0, xml]);
      expect(findAllSessionCommands(Command_DeckDel_ext)).toHaveLength(0);
      act(() => {
        deliverMessage(buildResponseMessage(buildResponse({
          cmdId: upload.cmdId,
          ext: Response_DeckUpload_ext,
          value: create(Response_DeckUploadSchema, {
            newFile: deckFile(12, 'Older Deck'),
          }),
        })));
      });

      const del = findLastSessionCommand(Command_DeckDel_ext);
      expect(del.value.deckId).toBe(1);
      expect(screen.getAllByRole('article', { name: 'Older Deck' })).toHaveLength(2);
      acknowledge(del.cmdId);
      await waitFor(() => expect(screen.getAllByRole('article', { name: 'Older Deck' })).toHaveLength(1));
      openFolder('Tournament');
      expect(tile('Older Deck')).toBeInTheDocument();
      expect(screen.queryByTestId('location')).toBeNull();
      expect(screen.getByText('DeckStorageSidebar.subtitle')).toBeInTheDocument();
    });
  });

  it('downloads every deck once and shows format, card count, bracket and price on its tile', async () => {
    await loadTree();

    await waitFor(() => expect(sentDeckDownloadIds().sort()).toEqual([1, 2]));
    expect(within(tile('Older Deck')).getByTitle('Decks.badge.priceLoading')).toBeInTheDocument();

    act(() => {
      respondToDeckDownload(1, codXml({ name: 'Older Deck', format: 'modern', comments: { priceUsd: 12.5 } }));
      respondToDeckDownload(2, codXml({
        name: 'Newer Deck',
        format: 'commander',
        bracketLevel: 3,
        comments: { priceUsd: 40, priceMissingCount: 2 },
      }));
    });

    expect(await within(tile('Newer Deck')).findByText(/^DeckFormat\.commander/)).toBeInTheDocument();
    expect(within(tile('Older Deck')).getByText(/^DeckFormat\.modern/)).toBeInTheDocument();
    expect(within(tile('Newer Deck')).getByText('Decks.badge.bracketShort')).toHaveAttribute('title', 'Decks.badge.bracket');
    expect(within(tile('Older Deck')).getByTitle('Decks.badge.priceTotal')).toHaveTextContent(/12\.50$/);
    expect(within(tile('Newer Deck')).getByTitle('Decks.badge.priceTotalMissing')).toHaveTextContent(/40\.00\+$/);
    expect(sentDeckDownloadIds()).toHaveLength(2);
  });

  it('offers each declared format as a filter, custom formats included, and filters by it', async () => {
    await loadTree();
    await waitFor(() => expect(sentDeckDownloadIds()).toHaveLength(2));
    act(() => {
      respondToDeckDownload(1, codXml({ name: 'Older Deck' }));
      respondToDeckDownload(2, codXml({ name: 'Newer Deck', format: 'netrunner' }));
    });

    const format = screen.getByRole('combobox', { name: 'DeckGridToolbar.format' });
    await waitFor(() => expect(within(format).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['DeckGridToolbar.anyFormat', 'Netrunner']));
    fireEvent.change(format, { target: { value: 'netrunner' } });
    expect(tile('Newer Deck')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Older Deck' })).toBeNull();
  });

  describe('details from storage (download, patch, upload over the same deck)', () => {
    const stored = codXml({ name: 'Older Deck', format: 'modern', main: [{ name: 'Lightning Bolt', quantity: 4 }] });

    async function startRename(name: string) {
      await loadTree();
      await waitFor(() => expect(downloadsOf(1)).toBe(1));
      act(() => {
        respondToDeckDownload(1, stored);
      });
      await waitFor(() => expect(within(tile('Older Deck')).getByTitle('Decks.badge.priceNone')).toBeInTheDocument());
      deckAction('Older Deck', 'DeckActionsMenu.rename');
      const field = await screen.findByRole('textbox', { name: 'DeckStorageEditDialog.name' });
      fireEvent.change(field, { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'DeckStorageEditDialog.save' }));
      await waitFor(() => expect(downloadsOf(1)).toBe(2));
      expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(0);
    }

    it('downloads the stored file again right before renaming, then uploads it over the same deck id', async () => {
      await startRename('Renamed Deck');
      act(() => {
        respondToDeckDownload(1, stored);
      });
      await waitFor(() => expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(1));
      const { value } = findLastSessionCommand(Command_DeckUpload_ext);
      expect(value.deckId).toBe(1);
      expect(isFieldSet(value, Command_DeckUploadSchema.field.path)).toBe(false);
      expect(parseCod(value.deckList).name).toBe('Renamed Deck');
      expect(parseCod(value.deckList).cards).toEqual(parseCod(stored).cards);
    });

    it('refuses to rename when the card list changed on the server since the list loaded', async () => {
      await startRename('Renamed Deck');
      act(() => {
        respondToDeckDownload(1, codXml({ name: 'Older Deck', format: 'modern', main: [{ name: 'Lightning Bolt', quantity: 3 }] }));
      });
      expect(await screen.findByText('DeckStorageEditDialog.changedElsewhere')).toBeInTheDocument();
      expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(0);
      expect(screen.getByRole('textbox', { name: 'DeckStorageEditDialog.name' })).toHaveValue('Older Deck');
    });
  });

  it('opens a deck in the editor route when its row is clicked', async () => {
    await loadTree();
    fireEvent.click(await screen.findByText('Older Deck'));
    expect(screen.getByTestId('location')).toHaveTextContent('/deck/1');
  });

  it('asks for confirmation, then deletes the deck through Command_DeckDel', async () => {
    await loadTree();

    await screen.findByRole('article', { name: 'Older Deck' });
    deckAction('Older Deck', 'DeckActionsMenu.delete');
    const dialog = screen.getByRole('alertdialog', { name: 'DeleteDeckDialog.title' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Common.action.cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(findAllSessionCommands(Command_DeckDel_ext)).toHaveLength(0);

    deckAction('Older Deck', 'DeckActionsMenu.delete');
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Common.action.delete' }));

    const { cmdId, value } = findLastSessionCommand(Command_DeckDel_ext);
    expect(value.deckId).toBe(1);
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({ cmdId })));
    });
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Older Deck' })).toBeNull());
    expect(screen.getByText('DeckStorageSidebar.subtitle')).toBeInTheDocument();
    expect(tile('Newer Deck')).toBeInTheDocument();
  });

  it('creates a named deck in the chosen format at the storage root and opens it', async () => {
    await loadTree();

    fireEvent.click(screen.getAllByRole('button', { name: /Decks\.list\.newDeck/ })[0]);
    fireEvent.change(screen.getByPlaceholderText('CreateDeckDialog.namePlaceholder'), { target: { value: '  Fresh Brew  ' } });
    fireEvent.change(within(screen.getByRole('dialog')).getByRole('combobox'), { target: { value: 'modern' } });
    fireEvent.click(screen.getByRole('button', { name: 'Common.action.create' }));

    const { cmdId, value } = findLastSessionCommand(Command_DeckUpload_ext);
    expect(value.path).toBe('');
    expect(isFieldSet(value, Command_DeckUploadSchema.field.path)).toBe(true);
    expect(value.deckId).toBe(0);
    const parsed = parseCod(value.deckList);
    expect(parsed.name).toBe('Fresh Brew');
    expect(parsed.format).toBe('modern');
    expect(parsed.cards).toEqual([]);

    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId,
        ext: Response_DeckUpload_ext,
        value: create(Response_DeckUploadSchema, {
          newFile: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 9, name: 'Fresh Brew' }),
        }),
      })));
    });
    expect(await screen.findByTestId('location')).toHaveTextContent('/deck/9');
  });

  it('imports a pasted decklist after resolving its cards, keeping unknown cards', async () => {
    await loadTree();

    fireEvent.click(screen.getByRole('button', { name: 'ImportMenu.import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ImportMenu.pasteOrOpen' }));
    expect(screen.getByRole('heading', { name: 'ImportDeckDialog.title' })).toBeInTheDocument();
    const nameInput = screen.getByRole('textbox', { name: 'ImportDeckDialog.deckName' });
    fireEvent.change(nameInput, { target: { value: 'Pasted' } });
    fireEvent.change(screen.getByPlaceholderText('ImportDeckDialog.placeholder'), {
      target: { value: 'Deck\n2 Sol Ring\n1 Mystery Card\n\nSideboard\n1 Lightning Bolt\nnot a card line' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.next' }));

    expect(await screen.findByText('ImportDeckDialog.review.matched')).toBeInTheDocument();
    expect(screen.getByText('ImportDeckDialog.review.missing')).toBeInTheDocument();
    expect(screen.getAllByText('ImportDeckDialog.review.unknown')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.importCards' }));

    const { value } = findLastSessionCommand(Command_DeckUpload_ext);
    expect(value.deckId).toBe(0);
    const parsed = parseCod(value.deckList);
    expect(parsed.name).toBe('Pasted');
    expect(parsed.format).toBe('');
    expect(parsed.cards.map((c) => [c.name, c.quantity, c.category])).toEqual([
      ['Sol Ring', 2, 'main'],
      ['Mystery Card', 1, 'main'],
      ['Lightning Bolt', 1, 'sideboard'],
      ['not a card line', 1, 'sideboard'],
    ]);
  });

  it('reviews a .cod file before importing, preserving its metadata and format', async () => {
    await loadTree();

    fireEvent.click(screen.getByRole('button', { name: 'ImportMenu.import' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ImportMenu.pasteOrOpen' }));
    const file = new File(
      [codXml({
        name: 'From Desktop',
        format: 'legacy',
        comments: { priceUsd: 99, description: 'kept' },
        main: [{ name: 'Lightning Bolt', quantity: 4, set: 'm11', num: '149' }],
      })],
      'desktop.cod',
      { type: 'application/xml' },
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('desktop.cod')).toBeInTheDocument();
    expect(screen.getByText('ImportDeckDialog.review.matched')).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Lightning Bolt')).toBeInTheDocument();
    expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'ImportDeckDialog.importCards' }));

    await waitFor(() => expect(findAllSessionCommands(Command_DeckUpload_ext)).toHaveLength(1));
    const { value } = findLastSessionCommand(Command_DeckUpload_ext);
    const parsed = parseCod(value.deckList);
    expect(parsed.name).toBe('From Desktop');
    expect(parsed.format).toBe('legacy');
    expect(parsed.meta.description).toBe('kept');
    expect(parsed.meta.priceUsd).toBe(99);
    expect(parsed.cards).toEqual([
      expect.objectContaining({ name: 'Lightning Bolt', quantity: 4, set: 'm11', collectorNumber: '149' }),
    ]);
  });

  it('refresh drops the cached summaries and re-requests the tree and every deck', async () => {
    const items = [deckFile(1, 'Older Deck'), deckFile(2, 'Newer Deck')];
    await loadTree(items);
    await waitFor(() => expect(sentDeckDownloadIds()).toHaveLength(2));
    act(() => {
      respondToDeckDownload(1, codXml({ name: 'Older Deck', format: 'modern' }));
      respondToDeckDownload(2, codXml({ name: 'Newer Deck', format: 'modern' }));
    });

    await waitFor(async () => expect(await dexieService.deckSummaries.count()).toBe(2));
    const listRequestsBefore = findAllSessionCommands(Command_DeckList_ext).length;
    fireEvent.click(screen.getByRole('button', { name: 'Decks.list.refreshLabel' }));
    expect(findAllSessionCommands(Command_DeckList_ext)).toHaveLength(listRequestsBefore + 1);
    act(() => {
      respondToDeckList(items);
    });
    await waitFor(() => expect(sentDeckDownloadIds().sort()).toEqual([1, 1, 2, 2]));
    act(() => {
      respondToDeckDownload(1, codXml({ name: 'Older Deck', format: 'legacy' }));
      respondToDeckDownload(2, codXml({ name: 'Newer Deck', format: 'vintage' }));
    });
    expect(await within(tile('Older Deck')).findByText(/^DeckFormat\.legacy/)).toBeInTheDocument();
    expect(within(tile('Newer Deck')).getByText(/^DeckFormat\.vintage/)).toBeInTheDocument();
  });

  it('switches between grid and list and remembers the choice', async () => {
    await loadTree();

    const compact = screen.getByRole('radio', { name: 'Decks.list.view.compact' });
    expect(compact).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(compact);
    expect(compact).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem('decks:viewMode')).toBe('compact');
    expect(store.getState().server.backendDecks).not.toBeNull();
  });
});
