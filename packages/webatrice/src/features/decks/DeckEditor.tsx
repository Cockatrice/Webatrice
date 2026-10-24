import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronsDownUp, ChevronsUpDown, PanelLeftClose, PanelRight, PanelRightClose, Rows4, Search, X } from 'lucide-react';

import { server } from '@cockatrice/datatrice';

import { AuthGuard, IconButton, SectionLabel } from '@app/components';
import { useRecordRecentDeck } from '@app/hooks';
import { readDeckPlaymat } from '@app/services';
import { AlertDialog } from '@app/dialogs';
import { ShortcutScope, useShortcut } from '@app/feature-widgets/shortcuts';
import { Layout } from '@app/feature-wrappers/layout';
import { useAppSelector } from '@app/store';
import { isCommanderFormat, isMtgFormat, RouteEnum } from '@app/types';

import { DeckBreakdown } from './components/breakdown/DeckBreakdown';
import CardSearchDock, { type CardSearchDockApi } from './components/CardSearchDock/CardSearchDock';
import { DeckEditorHeader } from './components/editor/DeckEditorHeader';
import { DeckNotFound } from './components/editor/DeckEditorShells';
import { DeckHistoryControls } from './components/editor/DeckHistoryControls';
import { DeckInspector } from './components/editor/DeckInspector';
import { DeckLegalitySummary } from './components/editor/DeckLegalitySummary';
import { DeckMainPane } from './components/editor/DeckMainPane';
import { CollapsedPaneRail } from './components/editor/CollapsedPaneRail';
import { deckEditorGridStyle } from './components/editor/editorLayout';
import { PaneResizer } from './components/editor/PaneResizer';
import {
  dockColorIdentity,
  inspectedRow,
  resolveInspectedRow,
  searchCardInspection,
  type InspectedCard,
} from './components/editor/editorSelection';
import { PlainAddCard } from './components/editor/PlainCardList';
import { SampleHandPanel } from './components/editor/SampleHandPanel';
import { groupDeckCards } from './deckGrouping';
import { deckColorIdentity, serializeDeckForSave } from './deckPersistence';
import { isBlankDeck } from './deckSharing';
import type { DecksLocationState } from './deckShortcuts';
import type { ScryfallSearchCard } from './search';
import { CardDetailDialog } from './dialogs/CardDetailDialog';
import { ExportDeckDialog } from './dialogs/ExportDeckDialog';
import { DeckPlaymatDialog } from './dialogs/DeckPlaymatDialog';
import { PrintingPickerDialog, type PrintingRequest } from './dialogs/PrintingPickerDialog';
import { ShareDeckDialog } from './dialogs/ShareDeckDialog';
import { useDeckEditor } from './hooks/useDeckEditor';
import { useDeckEditorFrame } from './hooks/useDeckEditorFrame';
import { useProvisionalDeckGroups } from './hooks/useProvisionalDeckGroups';
import { useDeckImageWarmer } from './hooks/useDeckImageWarmer';
import { useDeckLegality } from './hooks/useDeckLegality';
import { useDeckPricing } from './hooks/useDeckPricing';
import { useDeckShareCreate, useDeckSharingSupported } from './hooks/useDeckSharing';
import { useBracketCache } from './hooks/useBracketCache';
import { useInspectorPreview } from './hooks/useInspectorPreview';
import { useDeckEditorLayout } from './hooks/useDeckEditorLayout';
import { usePaneFocusHandoff } from './hooks/usePaneFocusHandoff';
import type { DeckCard } from './types';

const NO_CARDS: DeckCard[] = [];

const DeckEditor = () => {
  const { deckId: deckIdParam, token: draftToken } = useParams<{ deckId: string; token: string }>();
  const parsedDeckId = deckIdParam ? parseInt(deckIdParam, 10) : NaN;
  const deckId = Number.isFinite(parsedDeckId) ? parsedDeckId : null;

  const editor = useDeckEditor(deckId, draftToken ?? null);
  const frame = useDeckEditorFrame(deckId, editor);
  const { deck } = frame;
  const readyDeck = editor.hydrating ? null : editor.deck;
  useRecordRecentDeck(deckId, editor.loading ? null : readyDeck);

  const [selected, setSelected] = useState<InspectedCard | null>(null);
  const [printingRequest, setPrintingRequest] = useState<PrintingRequest | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<DeckCard | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [playmatOpen, setPlaymatOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const paneLayout = useDeckEditorLayout();
  const paneFocus = usePaneFocusHandoff();
  const addFieldRef = useRef<HTMLInputElement>(null);
  const dockApi = useRef<CardSearchDockApi | null>(null);
  const onDockReady = useCallback((api: CardSearchDockApi) => {
    dockApi.current = api;
  }, []);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isConnected = useAppSelector(server.Selectors.getIsConnected);
  const sharingSupported = useDeckSharingSupported();
  const share = useDeckShareCreate();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareRefusal, setShareRefusal] = useState<string | null>(null);

  const pricing = useDeckPricing(readyDeck, editor.setPriceCache);
  const legality = useDeckLegality(readyDeck);

  const editing = !editor.loading && readyDeck != null;
  useShortcut('deck.undo', () => editor.undo(), { scope: ShortcutScope.DECK_EDITOR, enabled: editing });
  useShortcut('deck.redo', () => editor.redo(), { scope: ShortcutScope.DECK_EDITOR, enabled: editing });
  useShortcut(
    'deck.save',
    () => (editor.saveState === 'failed' ? editor.retrySave() : editor.flushSave()),
    { scope: ShortcutScope.DECK_EDITOR, enabled: editing },
  );
  const openDecksDialog = (open: DecksLocationState['open']) =>
    navigate(RouteEnum.DECKS, { state: { open } satisfies DecksLocationState });
  useShortcut('deck.new', () => openDecksDialog('create'), { scope: ShortcutScope.DECK_EDITOR });
  useShortcut('deck.load', () => openDecksDialog('import'), { scope: ShortcutScope.DECK_EDITOR });

  const isMtg = isMtgFormat(deck.format);
  const isCommander = isCommanderFormat(deck.format);

  const tags = frame.tags;

  const hydratedGroups = useMemo(
    () => groupDeckCards(readyDeck?.cards ?? [], isCommander),
    [readyDeck?.cards, isCommander],
  );
  const provisionalGroups = useProvisionalDeckGroups(editor.hydrating ? editor.deck?.cards ?? NO_CARDS : NO_CARDS);
  const groups = editor.hydrating ? provisionalGroups : hydratedGroups;
  const cards = editor.deck?.cards ?? NO_CARDS;
  const readyCards = readyDeck?.cards ?? NO_CARDS;
  const colorIdentity = useMemo(() => dockColorIdentity(readyCards, isCommander), [readyCards, isCommander]);
  const bracketLevel = useBracketCache(readyCards, readyDeck?.bracketAssessment, editor.setBracketAssessment, isCommander && editing);
  const selectedIndex = useMemo(() => resolveInspectedRow(cards, selected), [cards, selected]);
  const preview = useInspectorPreview(cards, selected);
  useEffect(() => {
    if (selected && !selected.preview && selectedIndex < 0) {
      setSelected(null);
    }
  }, [selected, selectedIndex]);

  useDeckImageWarmer(
    deckId ?? (draftToken != null ? `draft:${draftToken}` : null),
    editor.deck,
    groups,
    editor.loading,
  );

  const startShare = () => {
    if (!isConnected) {
      setShareRefusal(t('DeckSharing.notConnected'));
    } else if (!editor.deck || isBlankDeck(editor.deck)) {
      setShareRefusal(t('DeckSharing.emptyDeck'));
    } else {
      share.reset();
      setShareOpen(true);
    }
  };

  const createShare = (name: string) => {
    if (!editor.deck || !isConnected) {
      return;
    }
    share.create({
      name,
      items: [{ deckList: serializeDeckForSave(editor.deck), colorIdentity: deckColorIdentity(editor.deck.cards) }],
    });
  };

  const { setCategory, addCard: editorAddCard } = editor;
  const { enter: enterPreview, leave: leavePreview } = preview;
  const { collapsedGroups, setGroupsCollapsed } = paneLayout;
  const selectCard = useCallback((card: DeckCard) => setSelected(inspectedRow(card)), []);
  const moveCard = useCallback((index: number, category: DeckCard['category']) => {
    const card = cards[index];
    setCategory(index, category);
    if (card) {
      setSelected(inspectedRow({ ...card, category }));
    }
  }, [cards, setCategory]);
  const addCard = useCallback((name: string, zone: 'main' | 'side', scryfallId?: string) => {
    void editorAddCard(name, { zone, scryfallId });
    const category = zone === 'side' ? 'sideboard' : 'main';
    setSelected((current) => (current?.preview && current.name.toLowerCase() === name.toLowerCase()
      ? { ...current, category, scryfallId }
      : { name, category, scryfallId, preview: { name, quantity: 1, category, scryfallId, lookupSource: 'unknown' } }));
  }, [editorAddCard]);
  const previewSearchCard = useCallback(
    (card: ScryfallSearchCard, providerId?: string) => setSelected(searchCardInspection(card, providerId)),
    [],
  );
  const hoverSearchCard = useCallback(
    (card: ScryfallSearchCard | null, providerId?: string) =>
      (card ? enterPreview(searchCardInspection(card, providerId)) : leavePreview()),
    [enterPreview, leavePreview],
  );
  const hoverDeckCard = useCallback(
    (card: DeckCard | null) => (card ? enterPreview(inspectedRow(card)) : leavePreview()),
    [enterPreview, leavePreview],
  );
  const changePrinting = useCallback((index: number, card: DeckCard) => setPrintingRequest({ index, card }), []);
  const focusAddField = useCallback(
    () => (isMtg ? dockApi.current?.focusSearch() : addFieldRef.current?.focus()),
    [isMtg],
  );
  const toggleGroup = useCallback(
    (label: string) => setGroupsCollapsed([label], !collapsedGroups.has(label)),
    [collapsedGroups, setGroupsCollapsed],
  );

  if (editor.notFound || (!editor.loading && !editor.deck)) {
    return <DeckNotFound reason={editor.loadError} />;
  }

  const { layout, prefs } = paneLayout;
  const docked = layout.inspectorDocked;
  const dockCollapsed = prefs.dockCollapsed;
  const inspectorCollapsed = docked && prefs.inspectorCollapsed;
  const showInspector = docked ? !inspectorCollapsed : inspectorOpen;
  const groupLabels = groups.map(({ label }) => label);
  const allGroupsCollapsed = groupLabels.length > 0 && groupLabels.every((label) => paneLayout.collapsedGroups.has(label));
  const collapsePane = (pane: 'dock' | 'inspector', collapsed: boolean) => {
    const overlay = pane === 'inspector' && !collapsed && !paneLayout.inspectorDocksWhenExpanded;
    paneFocus.updateThenFocus(() => {
      paneLayout.setPaneCollapsed(pane, collapsed);
      if (overlay) {
        setInspectorOpen(true);
      }
    }, overlay ? 'inspector-close' : `${pane}-${collapsed ? 'expand' : 'collapse'}`);
  };
  const resetLayout = () => {
    paneLayout.reset();
    setInspectorOpen(false);
  };

  const inspector = (
    <aside
      aria-label={t('DeckEditor.inspector.label')}
      className={[
        'flex min-h-0 w-[var(--deck-inspector-w)] flex-col gap-4 overflow-y-auto border-l border-border-subtle bg-bg-surface p-pad',
        docked ? '' : 'absolute inset-y-0 right-0 z-20 shadow-pop',
      ].join(' ')}
      onPointerEnter={preview.clear}
    >
      <div className="-mb-2 flex items-center">
        <SectionLabel>{t('DeckEditor.inspector.label')}</SectionLabel>
        {docked ? (
          <IconButton
            ref={paneFocus.target('inspector-collapse')}
            size="sm"
            label={t('DeckEditor.inspector.close')}
            className="ml-auto"
            onClick={() => collapsePane('inspector', true)}
          >
            <PanelRightClose size={14} />
          </IconButton>
        ) : (
          <IconButton
            ref={paneFocus.target('inspector-close')}
            size="sm"
            label={t('DeckEditor.inspector.close')}
            className="ml-auto"
            onClick={() => setInspectorOpen(false)}
          >
            <X size={14} />
          </IconButton>
        )}
      </div>
      {frame.readOnly ? (
        <div role="status" className="animate-pulse text-sm text-text-muted">
          {frame.waitingMessage ?? t('DeckEditor.shell.loadingDeck')}
        </div>
      ) : isMtg && (
        <>
          <DeckInspector
            selected={preview.card}
            index={preview.index}
            deckCards={deck.cards}
            prices={pricing.prices}
            isCommanderDeck={isCommander}
            onInc={editor.incQuantity}
            onDelete={editor.deleteCard}
            onSetCategory={moveCard}
            onChangePrinting={changePrinting}
            onShowDetails={setDetailSnapshot}
            onAdd={addCard}
          />
          <section className="flex flex-col gap-3 border-t border-border-subtle pt-4" aria-label={t('DeckEditor.inspector.stats')}>
            <SectionLabel>{t('DeckEditor.inspector.stats')}</SectionLabel>
            <DeckBreakdown
              cards={deck.cards}
              format={deck.format}
              cachedAssessment={deck.bracketAssessment}
              onAssessmentComputed={editor.setBracketAssessment}
            />
          </section>
        </>
      )}
      {!frame.readOnly && <SampleHandPanel cards={deck.cards} showImages={isMtg} />}
    </aside>
  );

  return (
    <Layout>
      <AuthGuard />
      <div
        ref={paneLayout.containerRef}
        className="relative grid h-full min-h-0 bg-bg-base"
        style={deckEditorGridStyle({ dock: layout.dockWidth, inspector: layout.inspectorWidth, inspectorColumn: docked })}
      >
        <aside
          aria-label={t('DeckEditor.dock.label')}
          className="flex min-h-0 flex-col overflow-hidden border-r border-border-subtle bg-bg-surface"
        >
          {dockCollapsed && (
            <CollapsedPaneRail
              ref={paneFocus.target('dock-expand')}
              side="left"
              title={t('DeckEditor.dock.label')}
              expandLabel={t('DeckEditor.layout.showDock')}
              icon={<Search size={15} aria-hidden />}
              onExpand={() => collapsePane('dock', false)}
            />
          )}
          <div hidden={dockCollapsed} inert={dockCollapsed} className="flex min-h-0 flex-1 flex-col">
            {frame.readOnly ? (
              <div role="status" className="animate-pulse p-pad text-sm text-text-muted">
                {frame.waitingMessage ?? t('DeckEditor.shell.loadingDeck')}
              </div>
            ) : isMtg ? (
              <CardSearchDock
                onAdd={addCard}
                onPreview={previewSearchCard}
                onHoverPreview={hoverSearchCard}
                onReady={onDockReady}
                colorIdentity={colorIdentity}
                format={deck.format}
                deckCards={deck.cards}
                headerAction={(
                  <IconButton
                    ref={paneFocus.target('dock-collapse')}
                    size="sm"
                    label={t('DeckEditor.layout.hideDock')}
                    onClick={() => collapsePane('dock', true)}
                  >
                    <PanelLeftClose size={14} />
                  </IconButton>
                )}
              />
            ) : (
              <div className="flex items-start gap-1 p-pad">
                <div className="min-w-0 flex-1">
                  <PlainAddCard onAdd={(name) => addCard(name, 'main')} inputRef={addFieldRef} />
                </div>
                <IconButton
                  ref={paneFocus.target('dock-collapse')}
                  label={t('DeckEditor.layout.hideDock')}
                  onClick={() => collapsePane('dock', true)}
                >
                  <PanelLeftClose size={15} />
                </IconButton>
              </div>
            )}
          </div>
        </aside>
        {!dockCollapsed && (
          <PaneResizer
            label={t('DeckEditor.layout.resizeDock')}
            hint={t('DeckEditor.layout.resizeHint')}
            side="left"
            width={layout.dockWidth}
            range={layout.dockRange}
            style={{ left: layout.dockWidth }}
            onResize={(width) => paneLayout.setPaneWidth('dock', width)}
            onResizeBy={(delta) => paneLayout.resizePaneBy('dock', delta)}
            onReset={() => paneLayout.resetPaneWidth('dock')}
            onCollapse={() => collapsePane('dock', true)}
          />
        )}

        <main className="relative flex min-h-0 min-w-0 flex-col">
          {frame.readOnlyReason && (
            <p role="status" className="px-5 pt-3 text-sm text-text-secondary">{frame.readOnlyReason}</p>
          )}
          <fieldset disabled={frame.readOnly} className="min-w-0 shrink-0" aria-label={frame.readOnlyReason ?? undefined}>
            <DeckEditorHeader
              deck={deck}
              saveState={editor.saveState}
              onRetrySave={editor.retrySave}
              totalMainboardCount={frame.totalMainboardCount}
              totalSideboardCount={frame.totalSideboardCount}
              tags={tags}
              colors={frame.colors}
              onNameChange={editor.setName}
              onFormatChange={editor.setFormat}
              onTagsChange={editor.setTags}
              onBannerChange={editor.setBanner}
              onEditPlaymat={() => setPlaymatOpen(true)}
              onExport={() => setExportOpen(true)}
              onShare={sharingSupported ? startShare : undefined}
              openDeck={{
                deckId,
                isModified: editor.isModified,
                isBlank: !editor.isModified && isBlankDeck(deck),
                saveNow: editor.saveNow,
                discardChanges: editor.discardChanges,
                pauseAutosave: editor.pauseAutosave,
                resumeAutosave: editor.resumeAutosave,
              }}
              history={(
                <DeckHistoryControls
                  history={editor.history}
                  canUndo={editor.canUndo}
                  canRedo={editor.canRedo}
                  onUndo={editor.undo}
                  onRedo={editor.redo}
                />
              )}
              legality={(
                <DeckLegalitySummary
                  format={deck.format}
                  status={legality.status}
                  illegalCount={legality.illegalCount}
                  unknownCount={legality.unknownCount}
                  loading={frame.readOnly || legality.loading}
                />
              )}
              prices={pricing.prices}
              pricesLoading={frame.readOnly || pricing.loading}
              isMtg={isMtg}
              bracketLevel={bracketLevel}
              onResetLayout={resetLayout}
              viewControls={isMtg && groupLabels.length > 0 && (
                <>
                  <IconButton
                    size="sm"
                    label={t(allGroupsCollapsed ? 'DeckEditor.layout.expandAll' : 'DeckEditor.layout.collapseAll')}
                    onClick={() => paneLayout.setGroupsCollapsed(groupLabels, !allGroupsCollapsed)}
                  >
                    {allGroupsCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={t('DeckEditor.layout.compactRows')}
                    active={prefs.density === 'compact'}
                    onClick={() => paneLayout.setDensity(prefs.density === 'compact' ? 'comfortable' : 'compact')}
                  >
                    <Rows4 size={14} />
                  </IconButton>
                </>
              )}
              trailing={!docked && (
                <IconButton
                  label={t('DeckEditor.inspector.toggle')}
                  className="border border-border-subtle"
                  active={inspectorOpen}
                  aria-expanded={inspectorOpen}
                  onClick={() => setInspectorOpen((open) => !open)}
                >
                  <PanelRight size={15} />
                </IconButton>
              )}
            />
          </fieldset>
          <DeckMainPane
            deck={deck}
            groups={groups}
            selectedIndex={selectedIndex}
            onSelect={selectCard}
            onPreview={isMtg ? hoverDeckCard : undefined}
            onInc={editor.incQuantity}
            onDelete={editor.deleteCard}
            onSetCategory={moveCard}
            onSetCommander={editor.setCommander}
            onChangePrinting={changePrinting}
            onShowDetails={isMtg ? setDetailSnapshot : undefined}
            onLastRowRemoved={focusAddField}
            isMtg={isMtg}
            isCommander={isCommander}
            readOnly={frame.readOnly}
            placeholderRows={frame.placeholderRows}
            waitingMessage={frame.waitingMessage}
            legality={legality.rows}
            density={prefs.density}
            collapsedGroups={paneLayout.collapsedGroups}
            onToggleGroup={toggleGroup}
          />
          {showInspector && !docked && inspector}
        </main>

        {showInspector && docked && inspector}
        {inspectorCollapsed && (
          <CollapsedPaneRail
            ref={paneFocus.target('inspector-expand')}
            side="right"
            title={t('DeckEditor.inspector.label')}
            expandLabel={t('DeckEditor.inspector.toggle')}
            icon={<PanelRight size={15} aria-hidden />}
            onExpand={() => collapsePane('inspector', false)}
          />
        )}
        {showInspector && docked && (
          <PaneResizer
            label={t('DeckEditor.layout.resizeInspector')}
            hint={t('DeckEditor.layout.resizeHint')}
            side="right"
            width={layout.inspectorWidth}
            range={layout.inspectorRange}
            style={{ left: `calc(100% - ${layout.inspectorWidth}px)` }}
            onResize={(width) => paneLayout.setPaneWidth('inspector', width)}
            onResizeBy={(delta) => paneLayout.resizePaneBy('inspector', delta)}
            onReset={() => paneLayout.resetPaneWidth('inspector')}
            onCollapse={() => collapsePane('inspector', true)}
          />
        )}
      </div>

      <PrintingPickerDialog
        request={frame.readOnly ? null : printingRequest}
        deckCards={deck?.cards}
        onClose={() => setPrintingRequest(null)}
        onPick={(printing) => {
          if (!printingRequest) {
            return;
          }
          editor.setPrinting(printingRequest.index, printing);
          setPrintingRequest(null);
        }}
      />

      {isMtg && !frame.readOnly && (
        <CardDetailDialog
          snapshot={detailSnapshot}
          deckCards={deck.cards}
          isCommanderDeck={isCommander}
          prices={pricing.prices}
          onClose={() => setDetailSnapshot(null)}
          onInc={(i) => editor.incQuantity(i, 1)}
          onDec={(i) => editor.incQuantity(i, -1)}
          onSetCategory={moveCard}
          onSetCommander={(i, v) => editor.setCommander(i, v)}
          onChangePrinting={(i, c) => {
            setDetailSnapshot(null);
            setPrintingRequest({ index: i, card: c });
          }}
          onDelete={(i) => {
            editor.deleteCard(i);
            setDetailSnapshot(null);
          }}
          onAdd={(name) => editor.addCard(name)}
        />
      )}

      {playmatOpen && !frame.readOnly && (
        <DeckPlaymatDialog
          playmat={readDeckPlaymat(deck.playmatXml)}
          onClose={() => setPlaymatOpen(false)}
          onSave={(playmat) => {
            editor.setPlaymat(playmat);
            setPlaymatOpen(false);
          }}
        />
      )}

      <ExportDeckDialog
        open={exportOpen && !frame.readOnly}
        onClose={() => setExportOpen(false)}
        deck={deck}
      />

      <ShareDeckDialog
        open={shareOpen && !frame.readOnly}
        defaultName={t('DeckSharing.defaultDeckName')}
        state={share.state}
        onClose={() => {
          share.reset();
          setShareOpen(false);
        }}
        onCreate={createShare}
      />

      <AlertDialog
        isOpen={shareRefusal != null}
        severity="info"
        title={t('DeckSharing.title')}
        message={shareRefusal ?? ''}
        onDismiss={() => setShareRefusal(null)}
      />
    </Layout>
  );
};

export default DeckEditor;
