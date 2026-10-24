import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { makeDeckList } from '@cockatrice/datatrice/testing';
import { ServerInfo_DeckStorage_FileSchema, ServerInfo_DeckStorage_TreeItemSchema } from '@cockatrice/sockatrice/generated';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../../__test-utils__';
import { clearDeckEditorCache, getCachedDeck, setCachedDeck } from '../../deckEditorCache';
import { deckSaveSignature } from '../../deckPersistence';
import { AUTOSAVE_DEBOUNCE_MS } from '../../hooks/useDeckAutosave';
import { useDeckEditor } from '../../hooks/useDeckEditor';
import type { HydratedDeck } from '../../types';
import { OpenDeckButton } from './OpenDeckButton';

function Editor() {
  const deckId = Number(useParams().deckId);
  const editor = useDeckEditor(deckId);
  return (
    <>
      <button onClick={() => editor.setName('Edited')}>Edit deck</button>
      <OpenDeckButton deckId={deckId} isBlank={false} {...editor} />
    </>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname} ${JSON.stringify(location.state)}`}</div>;
}

function setup() {
  const webClient = createMockWebClient();
  const deck: HydratedDeck = { name: 'Current', meta: { v: 1, updatedAt: 'x' }, cards: [], format: 'modern' };
  setCachedDeck(1, { deck, savedSignature: deckSaveSignature(deck) });
  const other = { ...deck, name: 'Other' };
  setCachedDeck(2, { deck: other, savedSignature: deckSaveSignature(other) });
  const view = renderWithProviders(
    <>
      <Routes><Route path="/deck/:deckId" element={<Editor />} /></Routes>
      <LocationProbe />
    </>,
    {
      webClient,
      route: '/deck/1',
      preloadedState: {
        ...connectedState,
        server: {
          ...connectedState.server,
          backendDecks: makeDeckList({ root: { items: [create(ServerInfo_DeckStorage_TreeItemSchema, {
            id: 2, name: 'Other', file: create(ServerInfo_DeckStorage_FileSchema, {}),
          })] } }),
        } as never,
      },
    },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit deck' }));
  fireEvent.click(screen.getByRole('button', { name: 'OpenDeckButton.label' }));
  fireEvent.click(screen.getByRole('button', { name: 'Other' }));
  expect(screen.getByRole('dialog', { name: 'OpenDeckButton.confirmTitle' })).toBeInTheDocument();
  return { ...view, webClient };
}

async function choose(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `OpenDeckButton.${label}` }));
  });
}

function waitPastDebounce() {
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 10);
  });
}

describe('opening a deck while autosave is pending', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearDeckEditorCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearDeckEditorCache();
  });

  it('holds the pending upload throughout the prompt and discards without uploading', async () => {
    const { webClient, unmount } = setup();
    waitPastDebounce();

    await choose('discard');
    waitPastDebounce();
    expect(screen.getByTestId('location')).toHaveTextContent('/deck/2 {"replacesDeckId":1}');
    expect(getCachedDeck(1)).toBeUndefined();
    unmount();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();
    expect(webClient.request.session.deckUpload).not.toHaveBeenCalled();
  });

  it('saves only on Save and opens after the server acknowledges it', async () => {
    const { store, webClient } = setup();
    waitPastDebounce();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();

    await choose('save');
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location')).toHaveTextContent('/deck/1 null');
    await act(async () => {
      store.dispatch(server.Actions.deckUpdated({
        deckId: 1, treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 1, name: 'Edited' }),
      }));
      vi.mocked(webClient.request.session.deckUpdate).mock.calls[0][4]!(null);
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/deck/2 {"replacesDeckId":1}');
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['cancel', '/deck/1 null'],
    ['openInNewTab', '/deck/2 null'],
  ])('resumes saving the edited deck after %s', async (choice, destination) => {
    const { webClient } = setup();
    waitPastDebounce();
    expect(webClient.request.session.deckUpdate).not.toHaveBeenCalled();

    await choose(choice);
    waitPastDebounce();
    expect(screen.getByTestId('location')).toHaveTextContent(destination);
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledTimes(1);
    expect(webClient.request.session.deckUpdate).toHaveBeenCalledWith(
      1, expect.stringContaining('<deckname>Edited</deckname>'), undefined, '', expect.any(Function),
    );
  });
});
