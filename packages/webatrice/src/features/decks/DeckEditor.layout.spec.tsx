import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { connected31State, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import DeckEditor from './DeckEditor';
import { clearDeckEditorCache, setCachedDeck } from './deckEditorCache';
import { DECK_LAYOUT_STORAGE_KEY } from './deckEditorLayout';
import { deckSaveSignature } from './deckPersistence';
import type { DeckCard, HydratedDeck } from './types';

const card = (name: string, typeLine: string, category: DeckCard['category'] = 'main'): DeckCard =>
  ({ name, quantity: 1, category, typeLine, lookupSource: 'scryfall' });

function mockWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width } as DOMRect);
}

const DEFAULT_CARDS = [card('Ponder', 'Sorcery'), card('Opt', 'Instant'), card('Forest', 'Basic Land — Forest')];

async function renderEditor(cards: DeckCard[] = DEFAULT_CARDS) {
  const deck: HydratedDeck = {
    name: 'Layout',
    format: 'standard',
    cards,
    meta: { v: 1, updatedAt: '' },
  };
  setCachedDeck(5, { deck, savedSignature: deckSaveSignature(deck) });
  renderWithProviders(
    <Routes><Route path="/deck/:deckId" element={<DeckEditor />} /></Routes>,
    { route: '/deck/5', preloadedState: connected31State, webClient: createMockWebClient() },
  );
  await screen.findByRole('complementary', { name: 'DeckEditor.dock.label' });
}

const stored = () => JSON.parse(window.localStorage.getItem(DECK_LAYOUT_STORAGE_KEY) ?? 'null');

beforeEach(() => clearDeckEditorCache());
afterEach(() => {
  clearDeckEditorCache();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('DeckEditor layout', () => {
  it('docks the inspector with resize handles when the editor has room', async () => {
    mockWidth(1204);
    await renderEditor();
    expect(screen.getByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'DeckEditor.inspector.toggle' })).toBeNull();
    expect(screen.getByRole('separator', { name: 'DeckEditor.layout.resizeDock' })).toHaveAttribute('aria-valuenow', '300');
    expect(screen.getByRole('separator', { name: 'DeckEditor.layout.resizeInspector' })).toBeInTheDocument();
  });

  it('keeps the inspector as an overlay when the editor is too narrow', async () => {
    mockWidth(900);
    await renderEditor();
    expect(screen.queryByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeNull();
    expect(screen.getByRole('button', { name: 'DeckEditor.inspector.toggle' })).toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'DeckEditor.layout.resizeInspector' })).toBeNull();
  });

  it('collapses and expands each side pane, moving focus to the control that brings it back', async () => {
    mockWidth(1364);
    await renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' }));
    expect(screen.queryByRole('textbox', { name: /CardSearchDock/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'DeckEditor.layout.showDock' })).toHaveFocus();
    expect(screen.queryByRole('separator', { name: 'DeckEditor.layout.resizeDock' })).toBeNull();
    expect(stored().dockCollapsed).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.showDock' }));
    expect(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' })).toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.inspector.close' }));
    expect(screen.queryByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeNull();
    expect(screen.getByRole('button', { name: 'DeckEditor.inspector.toggle' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.inspector.toggle' }));
    expect(screen.getByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeInTheDocument();
  });

  it('collapses a type group, skips its rows, and remembers it', async () => {
    mockWidth(1364);
    await renderEditor();
    const instants = screen.getByRole('button', { name: /^DeckEditor\.section\.instant/ });
    expect(instants).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(instants);
    expect(instants).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Opt' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ponder' })).toBeInTheDocument();
    expect(stored().collapsedGroups).toEqual(['Instant']);

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.collapseAll' }));
    expect(screen.queryByRole('row')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.expandAll' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('switches to compact rows and resets the whole layout from the More menu', async () => {
    mockWidth(1364);
    await renderEditor();
    const compact = screen.getByRole('button', { name: 'DeckEditor.layout.compactRows' });
    fireEvent.click(compact);
    expect(compact).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^DeckEditor\.section\.land/ }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' }));
    expect(stored()).toMatchObject({ density: 'compact', dockCollapsed: true, collapsedGroups: ['Land'] });

    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.more' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'DeckHeader.resetLayout' }));

    expect(screen.getByRole('button', { name: 'DeckEditor.layout.compactRows' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forest' })).toBeInTheDocument();
    expect(stored()).toMatchObject({ density: 'comfortable', dockCollapsed: false, collapsedGroups: [] });
  });

  it('opens the overlay and focuses its close button when an expanded inspector cannot dock', async () => {
    window.localStorage.setItem(DECK_LAYOUT_STORAGE_KEY, JSON.stringify({ inspectorCollapsed: true }));
    mockWidth(900);
    await renderEditor();
    expect(screen.queryByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.inspector.toggle' }));

    expect(screen.getByRole('complementary', { name: 'DeckEditor.inspector.label' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DeckEditor.inspector.close' })).toHaveFocus();
    expect(stored().inspectorCollapsed).toBe(false);
  });

  it('keeps focus and the other groups in place when collapsing a group moves the column breaks', async () => {
    mockWidth(527);
    const many = (type: string) => Array.from({ length: 10 }, (_, i) => card(`${type} ${i}`, type));
    await renderEditor([...many('Creature'), ...many('Instant'), ...many('Sorcery')]);
    const instants = screen.getByRole('button', { name: /^DeckEditor\.section\.instant/ });
    const sorceries = screen.getByRole('button', { name: /^DeckEditor\.section\.sorcery/ });
    const instantRow = screen.getByRole('button', { name: 'Instant 3' });

    sorceries.focus();
    fireEvent.click(sorceries);

    expect(sorceries).toHaveAttribute('aria-expanded', 'false');
    expect(sorceries).toHaveFocus();
    expect(instants.isConnected).toBe(true);
    expect(instantRow.isConnected).toBe(true);
  });

  it('keeps the Find cards search while the pane is collapsed', async () => {
    mockWidth(1364);
    await renderEditor();
    fireEvent.change(screen.getByPlaceholderText('CardSearchDock.placeholder'), { target: { value: 'bolt' } });

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' }));
    expect(screen.getByPlaceholderText('CardSearchDock.placeholder')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.layout.showDock' }));

    expect(screen.getByPlaceholderText('CardSearchDock.placeholder')).toHaveValue('bolt');
    expect(screen.getByRole('button', { name: 'DeckEditor.layout.hideDock' })).toHaveFocus();
  });
});
