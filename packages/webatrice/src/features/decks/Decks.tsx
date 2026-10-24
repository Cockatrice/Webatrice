import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generatePath, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { server } from '@cockatrice/datatrice';
import { AuthGuard, Button } from '@app/components';
import { AlertDialog } from '@app/dialogs';
import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { Layout } from '@app/feature-wrappers/layout';
import { useAppSelector } from '@app/store';
import { RouteEnum } from '@app/types';
import { useDeckEditorRoutePrefetch } from '../../RoutePrefetch';

import type { DeckActions, DeckStorageEditKind } from './components/list/DeckActionsMenu';
import { DeckGridToolbar } from './components/list/DeckGridToolbar';
import { DeckListEmpty, DeckListError, DeckListLoading, DeckStorageError } from './components/list/DeckListStates';
import { DeckStorageSidebar } from './components/list/DeckStorageSidebar';
import { DeckListRow, DeckTile } from './components/list/DeckTile';
import { parentDeckPath, type DeckFolderEntry } from './deckFolders';
import type { DeckTileView } from './deckGrid';
import { deckShareQuery, type DeckShareLink } from './deckSharing';
import type { DecksLocationState } from './deckShortcuts';
import type { FlatDeck } from './deckTree';
import { CreateDeckDialog } from './dialogs/CreateDeckDialog';
import { CreateFolderDialog } from './dialogs/CreateFolderDialog';
import { DeckShareLinksDialog } from './dialogs/DeckShareLinksDialog';
import { DeckStorageEditDialog } from './dialogs/DeckStorageEditDialog';
import { DeleteDeckDialog } from './dialogs/DeleteDeckDialog';
import { DeleteFolderDialog } from './dialogs/DeleteFolderDialog';
import { ImportDeckDialog } from './dialogs/ImportDeckDialog';
import { MoveDeckDialog } from './dialogs/MoveDeckDialog';
import { OpenShareLinkDialog } from './dialogs/OpenShareLinkDialog';
import { ShareDeckDialog } from './dialogs/ShareDeckDialog';
import { DECK_LIST_ROW_ATTRIBUTE, useDeckDeleteFocus } from './hooks/useDeckDeleteFocus';
import { useDeckFileDownloads } from './hooks/useDeckFileDownloads';
import { useDeckGrid } from './hooks/useDeckGrid';
import { useDeckList } from './hooks/useDeckList';
import { useDeckListViewMode } from './hooks/useDeckListViewMode';
import { useDeckShareCreate, useDeckSharingSupported, useDeckVisibility } from './hooks/useDeckSharing';
import { useDeckShareLinks } from './hooks/useDeckShareLinks';
import { dragHasFiles, fromDataTransfer, type SourceFile } from './migration/fileSources';
import { MigrationDialog } from './migration/MigrationDialog';

const FOLDER_PARAM = 'folder';

function Decks() {
  const navigate = useNavigate();
  const prefetchDeckEditor = useDeckEditorRoutePrefetch();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedPath = searchParams.get(FOLDER_PARAM) ?? '';
  const userName = useAppSelector(server.Selectors.getUser)?.name;

  const openDeckById = useCallback(
    (deckId: number) => navigate(generatePath(RouteEnum.DECK, { deckId: String(deckId) })),
    [navigate],
  );
  const list = useDeckList({ onDeckCreated: openDeckById, folderPath: requestedPath });
  const grid = useDeckGrid(list.decks, list.summaries);
  const files = useDeckFileDownloads();
  const [viewMode, setViewMode] = useDeckListViewMode();

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<SourceFile[] | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<FlatDeck | null>(null);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<DeckFolderEntry | null>(null);
  const [pendingMove, setPendingMove] = useState<FlatDeck | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ kind: DeckStorageEditKind; deck: FlatDeck } | null>(null);

  const sharingSupported = useDeckSharingSupported();
  const share = useDeckShareCreate();
  const visibility = useDeckVisibility();
  const [shareTarget, setShareTarget] = useState<{ deckId: number } | { folderPath: string } | null>(null);
  const [shareLinksOpen, setShareLinksOpen] = useState(false);
  const [openLinkOpen, setOpenLinkOpen] = useState(false);

  const location = useLocation();
  useEffect(() => {
    const open = (location.state as DecksLocationState | null)?.open;
    if (open === 'create') {
      setCreateOpen(true);
    } else if (open === 'import') {
      setImportOpen(true);
    } else if (open === 'migrate') {
      setMigrateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per navigation, not on every state read
  }, [location.key]);
  useShortcut('deck.new', () => setCreateOpen(true), { scope: ShortcutScope.DECK_EDITOR, enabled: list.isConnected });
  useShortcut('deck.load', () => setImportOpen(true), { scope: ShortcutScope.DECK_EDITOR, enabled: list.isConnected });
  const shareLinks = useDeckShareLinks(shareLinksOpen);

  const startShare = (target: { deckId: number } | { folderPath: string }) => {
    share.reset();
    setShareTarget(target);
  };

  const createShare = (name: string) => {
    if (!shareTarget || !list.isConnected) {
      return;
    }
    share.create('folderPath' in shareTarget
      ? { name, folderPath: shareTarget.folderPath }
      : { name, items: [{ deckId: shareTarget.deckId }] });
  };

  const openShareLink = (link: DeckShareLink) => {
    setOpenLinkOpen(false);
    navigate({ pathname: RouteEnum.SHARED_DECK, search: `?${deckShareQuery(link)}` });
  };

  const openFolder = (path: string) => {
    setSearchParams(path ? { [FOLDER_PARAM]: path } : {});
  };

  const handleCreate = (name: string, format: string) => {
    if (list.createDeck(name, format)) {
      setCreateOpen(false);
    }
  };

  const openMigration = (files?: SourceFile[]) => {
    setDroppedFiles(files);
    setMigrateOpen(true);
  };

  const handleImport = (xml: string, colorIdentity: string): boolean => {
    const sent = list.importDeck(xml, colorIdentity);
    if (sent) {
      setImportOpen(false);
    }
    return sent;
  };

  const listRef = useRef<HTMLDivElement>(null);
  const shownSections = useMemo(() => [{ section: 'grid', decks: grid.tiles.map((view) => view.deck) }], [grid.tiles]);
  const focusAfterDelete = useDeckDeleteFocus(shownSections, listRef);

  const confirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    focusAfterDelete(pendingDelete);
    list.deleteDeck(pendingDelete);
    setPendingDelete(null);
  };

  const confirmFolderDelete = () => {
    if (!pendingFolderDelete) {
      return;
    }
    const parent = parentDeckPath(pendingFolderDelete.path);
    list.deleteFolder(pendingFolderDelete.path);
    setPendingFolderDelete(null);
    if (list.folder.path === pendingFolderDelete.path || list.folder.path.startsWith(`${pendingFolderDelete.path}/`)) {
      openFolder(parent);
    }
  };

  const { folder, currentFolder } = list;
  const canMove = list.folderPaths.length > 1;
  const folderCount = currentFolder ? currentFolder.folderCount : list.folderPaths.length - 1;

  const deckActions = ({ deck }: DeckTileView): DeckActions => ({
    onOpen: () => openDeckById(deck.id),
    onEdit: (kind) => setPendingEdit({ kind, deck }),
    editDisabledReason: !list.isConnected
      ? t('Decks.grid.disconnected')
      : list.documents.has(deck.id) ? undefined : t('Decks.grid.stillLoading'),
    onShare: sharingSupported ? () => startShare({ deckId: deck.id }) : undefined,
    onTogglePublic: sharingSupported ? () => visibility.toggle({ deckId: deck.id }, deck.visibility) : undefined,
    onMove: canMove ? () => setPendingMove(deck) : undefined,
    onDownload: () => files.download([deck], deck.path),
    onDelete: () => setPendingDelete(deck),
  });

  const Item = viewMode === 'compact' ? DeckListRow : DeckTile;
  const noDecks = list.decks.length === 0;

  return (
    <Layout>
      <AuthGuard />
      <div className="flex h-full min-h-0 bg-bg-base">
        <DeckStorageSidebar
          loading={list.loading}
          deckTotal={list.deckTotal}
          folders={list.folderTree}
          activePath={folder.path}
          isConnected={list.isConnected}
          onSelect={openFolder}
          onCreate={() => setCreateOpen(true)}
          onImport={() => setImportOpen(true)}
          onMigrate={() => openMigration()}
          onNewFolder={() => setNewFolderOpen(true)}
          publicDeckCount={list.publicDeckTotal}
          onPublicDecks={sharingSupported && userName
            ? () => navigate(generatePath(RouteEnum.PUBLIC_DECKS, { userName }))
            : undefined}
          onShareLinks={sharingSupported ? () => setShareLinksOpen(true) : undefined}
          onOpenShareLink={sharingSupported ? () => setOpenLinkOpen(true) : undefined}
        />
        <div
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
          onDragOver={(event) => {
            if (!migrateOpen && dragHasFiles(event.dataTransfer)) {
              event.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            if (migrateOpen || !dragHasFiles(event.dataTransfer)) {
              return;
            }
            event.preventDefault();
            setDragging(false);
            void fromDataTransfer(event.dataTransfer).then(openMigration);
          }}
        >
          {dragging && (
            <div
              aria-hidden
              className={[
                'pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-ui-lg',
                'border-2 border-dashed border-accent bg-accent-soft/90 text-sm font-semibold text-text-primary',
              ].join(' ')}
            >
              {t('Decks.dropToImport')}
            </div>
          )}
          <DeckGridToolbar
            title={currentFolder?.name ?? t('DeckStorageSidebar.allDecks')}
            deckCount={list.decks.length}
            folderCount={Math.max(folderCount, 0)}
            folder={currentFolder}
            folderActions={currentFolder ? {
              onNewFolder: () => setNewFolderOpen(true),
              onDownload: () => files.download(list.decksUnder(currentFolder.path), currentFolder.path),
              onDelete: () => setPendingFolderDelete(currentFolder),
              onShare: sharingSupported ? () => startShare({ folderPath: currentFolder.path }) : undefined,
              onTogglePublic: sharingSupported
                ? () => visibility.toggle({ folderPath: currentFolder.path }, currentFolder.visibility)
                : undefined,
            } : undefined}
            grid={grid}
            isConnected={list.isConnected}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onRefresh={list.refresh}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-12 pt-4">
            <div ref={listRef} className="focus:outline-none">
              {list.loading && !list.listError && <DeckListLoading />}
              {list.loading && list.listError && <DeckListError message={list.listError} onRetry={list.refresh} />}
              {list.storageError && <DeckStorageError message={list.storageError} onDismiss={list.dismissStorageError} />}
              {!list.loading && noDecks && folder.path === '' && (
                <DeckListEmpty
                  onCreate={() => setCreateOpen(true)}
                  onMigrate={() => openMigration()}
                  onImport={() => setImportOpen(true)}
                  disabled={!list.isConnected}
                />
              )}
              {!list.loading && noDecks && folder.path !== '' && (
                <p className="text-[13px] text-text-muted">{t('DeckFolders.empty')}</p>
              )}
              {!list.loading && !noDecks && grid.tiles.length === 0 && grid.pending === 0 && (
                <div className="flex flex-col items-start gap-2 text-[13px] text-text-muted">
                  <p>{t('Decks.grid.noMatches')}</p>
                  <Button size="sm" onClick={grid.clearFilters}>{t('DeckGridToolbar.clear')}</Button>
                </div>
              )}
              {!list.loading && grid.tiles.length > 0 && (
                <ul
                  aria-label={t('Decks.grid.decks')}
                  className={viewMode === 'compact' ? 'flex flex-col gap-2' : 'grid gap-gap'}
                  style={viewMode === 'compact' ? undefined : { gridTemplateColumns: 'repeat(auto-fill, minmax(232px, 1fr))' }}
                >
                  {grid.tiles.map((view) => (
                    <li key={view.deck.id} {...{ [DECK_LIST_ROW_ATTRIBUTE]: view.deck.id }}>
                      <Item view={view} actions={deckActions(view)} onPrefetch={prefetchDeckEditor} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {pendingDelete && (
        <DeleteDeckDialog
          deckName={pendingDelete.name}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {pendingFolderDelete && (
        <DeleteFolderDialog
          folder={pendingFolderDelete}
          onCancel={() => setPendingFolderDelete(null)}
          onConfirm={confirmFolderDelete}
        />
      )}

      {pendingMove && (
        <MoveDeckDialog
          deck={pendingMove}
          folderPaths={list.folderPaths}
          onCancel={() => setPendingMove(null)}
          onMove={(target) => {
            list.moveDeck(pendingMove, target);
            setPendingMove(null);
          }}
        />
      )}

      {pendingEdit && list.documents.has(pendingEdit.deck.id) && (
        <DeckStorageEditDialog
          key={`${pendingEdit.kind}:${pendingEdit.deck.id}`}
          kind={pendingEdit.kind}
          deck={pendingEdit.deck}
          xml={list.documents.get(pendingEdit.deck.id)!}
          onSaved={list.detailsSaved}
          onClose={() => setPendingEdit(null)}
        />
      )}

      <CreateFolderDialog
        open={newFolderOpen}
        parentPath={folder.path}
        siblings={folder.folders.map((f) => f.name)}
        onClose={() => setNewFolderOpen(false)}
        onCreate={(name) => {
          list.createFolder(name);
          setNewFolderOpen(false);
        }}
      />

      <ImportDeckDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
      />

      <MigrationDialog
        open={migrateOpen}
        initialFiles={droppedFiles}
        onClose={() => setMigrateOpen(false)}
        onPasteInstead={() => {
          setMigrateOpen(false);
          setImportOpen(true);
        }}
      />

      <CreateDeckDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <ShareDeckDialog
        open={shareTarget != null}
        defaultName={t('DeckSharing.defaultDecksName')}
        state={share.state}
        onClose={() => {
          share.reset();
          setShareTarget(null);
        }}
        onCreate={createShare}
      />

      {shareLinksOpen && (
        <DeckShareLinksDialog
          shares={shareLinks.shares}
          error={shareLinks.error}
          pending={shareLinks.pending}
          onRevoke={shareLinks.revoke}
          onClose={() => setShareLinksOpen(false)}
        />
      )}

      <OpenShareLinkDialog open={openLinkOpen} onClose={() => setOpenLinkOpen(false)} onOpen={openShareLink} />

      <AlertDialog
        isOpen={visibility.error != null}
        title={t('DeckSharing.error')}
        message={visibility.error ?? ''}
        onDismiss={visibility.clearError}
      />
    </Layout>
  );
}

export default Decks;
