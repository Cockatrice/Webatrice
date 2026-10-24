import { act, fireEvent, screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { connected31State, createMockWebClient, renderWithProviders } from '../../__test-utils__';
import DeckEditor from './DeckEditor';
import { clearDeckEditorCache, setCachedDeck } from './deckEditorCache';
import { deckSaveSignature } from './deckPersistence';
import { PREVIEW_LEAVE_DELAY_MS } from './hooks/useInspectorPreview';
import type { DeckCard, HydratedDeck } from './types';
import * as grouping from './deckGrouping';
import * as editorHook from './hooks/useDeckEditor';
import { DeckCardRow } from './components/editor/DeckCardRow';

vi.mock('./components/editor/DeckCardRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./components/editor/DeckCardRow')>();
  return { ...actual, DeckCardRow: vi.fn(actual.DeckCardRow) };
});

const card = (name: string, category: DeckCard['category'] = 'main', typeLine = 'Instant'): DeckCard =>
  ({ name, quantity: 1, category, typeLine, lookupSource: 'scryfall' });

beforeEach(() => clearDeckEditorCache());
afterEach(() => {
  clearDeckEditorCache();
  vi.useRealTimers();
});

async function renderEditor() {
  const deck: HydratedDeck = {
    name: 'Preview',
    format: 'standard',
    cards: [card('Ponder'), card('Opt'), card('Duress', 'sideboard', 'Sorcery')],
    meta: { v: 1, updatedAt: '' },
  };
  setCachedDeck(5, { deck, savedSignature: deckSaveSignature(deck) });
  renderWithProviders(
    <Routes><Route path="/deck/:deckId" element={<DeckEditor />} /></Routes>,
    { route: '/deck/5', preloadedState: connected31State, webClient: createMockWebClient() },
  );
  fireEvent.click(await screen.findByRole('button', { name: 'DeckEditor.inspector.toggle' }));
  return within(screen.getByRole('region', { name: 'DeckInspector.title' }));
}

const rowOf = (name: string) => screen.getAllByRole('row').find((row) => within(row).queryByRole('button', { name }))!;

describe('DeckEditor inspector preview', () => {
  it('renders hydrated rows while every image load is still pending', async () => {
    vi.stubGlobal('Image', class {
      src = '';
    });
    const deck: HydratedDeck = {
      name: 'Pending images', format: 'standard', meta: { v: 1, updatedAt: '' },
      cards: [{ ...card('Pending card'), imageUri: 'https://img/pending.jpg' }],
    };
    setCachedDeck(6, { deck, savedSignature: deckSaveSignature(deck) });
    try {
      renderWithProviders(
        <Routes><Route path="/deck/:deckId" element={<DeckEditor />} /></Routes>,
        { route: '/deck/6', preloadedState: connected31State, webClient: createMockWebClient() },
      );
      expect(await screen.findByRole('button', { name: 'Pending card' })).toBeInTheDocument();
      expect(screen.queryByText('DeckEditor.shell.preloading')).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('updates hover previews without rendering unchanged deck rows', async () => {
    const inspector = await renderEditor();
    fireEvent.click(rowOf('Ponder'));
    vi.mocked(DeckCardRow).mockClear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.pointerEnter(rowOf('Opt'));
    expect(inspector.getByText('Opt')).toBeInTheDocument();
    expect(DeckCardRow).not.toHaveBeenCalled();
    fireEvent.pointerLeave(rowOf('Opt'));
    act(() => vi.advanceTimersByTime(PREVIEW_LEAVE_DELAY_MS));
    expect(inspector.getByText('Ponder')).toBeInTheDocument();
    expect(DeckCardRow).not.toHaveBeenCalled();
  });

  it('regroups only when cards or commander grouping change', async () => {
    const group = vi.spyOn(grouping, 'groupDeckCards');
    const hook = vi.spyOn(editorHook, 'useDeckEditor');
    try {
      await renderEditor();
      const current = () => hook.mock.results.at(-1)!.value as ReturnType<typeof editorHook.useDeckEditor>;
      group.mockClear();
      act(() => current().setName('Renamed'));
      expect(group).not.toHaveBeenCalled();
      act(() => current().setTags(['Test']));
      expect(group).not.toHaveBeenCalled();
      act(() => current().setPriceCache(10, 0));
      expect(group).not.toHaveBeenCalled();
      act(() => current().setBanner({ name: 'Opt' }));
      expect(group).not.toHaveBeenCalled();
      act(() => current().incQuantity(0, 1));
      expect(group).toHaveBeenCalledTimes(1);
      group.mockClear();
      act(() => current().setFormat('commander'));
      expect(group).toHaveBeenCalledTimes(1);
    } finally {
      group.mockRestore();
      hook.mockRestore();
    }
  });

  it('previews a hovered row and returns to the clicked card when the pointer leaves', async () => {
    const inspector = await renderEditor();
    fireEvent.click(rowOf('Ponder'));
    expect(inspector.getByText('Ponder')).toBeInTheDocument();

    vi.useFakeTimers();
    fireEvent.pointerEnter(rowOf('Duress'));
    expect(inspector.getByText('Duress')).toBeInTheDocument();
    expect(inspector.getByText('Sorcery')).toBeInTheDocument();

    fireEvent.pointerLeave(rowOf('Duress'));
    act(() => vi.advanceTimersByTime(PREVIEW_LEAVE_DELAY_MS));
    expect(inspector.getByText('Ponder')).toBeInTheDocument();
    expect(inspector.queryByText('Duress')).not.toBeInTheDocument();
  });

  it('shows the selected card again as soon as the pointer reaches the inspector', async () => {
    const inspector = await renderEditor();
    fireEvent.click(rowOf('Ponder'));
    fireEvent.pointerEnter(rowOf('Opt'));
    expect(inspector.getByText('Opt')).toBeInTheDocument();

    fireEvent.pointerEnter(screen.getByRole('complementary', { name: 'DeckEditor.inspector.label' }));
    expect(inspector.getByText('Ponder')).toBeInTheDocument();
  });

  it('previews a row reached with the keyboard', async () => {
    const inspector = await renderEditor();
    fireEvent.focus(rowOf('Opt'));
    expect(inspector.getByText('Opt')).toBeInTheDocument();
  });
});
