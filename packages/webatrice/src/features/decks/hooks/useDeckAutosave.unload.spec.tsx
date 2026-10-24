import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';

import { server } from '@cockatrice/datatrice';
import { ServerInfo_DeckStorage_TreeItemSchema } from '@cockatrice/sockatrice/generated';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { hasUnloadRisk } from '../../../services/unloadGuard';
import { deleteDraft, setCachedDraft } from '../deckEditorCache';
import type { HydratedDeck } from '../types';
import { AUTOSAVE_DEBOUNCE_MS, useDeckAutosave, type DeckAutosave } from './useDeckAutosave';

const deck: HydratedDeck = { name: 'Draft', meta: { v: 1, updatedAt: 'x' }, cards: [], format: '' };
let autosave: DeckAutosave;

function Probe({ onStored }: { onStored: () => void }) {
  autosave = useDeckAutosave(null, () => deck, null, { key: 'draft', onStored });
  return null;
}

it('guards a changed draft through upload, then releases it once stored', () => {
  vi.useFakeTimers();
  try {
    const onStored = vi.fn();
    const webClient = createMockWebClient();
    setCachedDraft('draft', deck);
    const { store } = renderWithProviders(<Probe onStored={onStored} />, { preloadedState: connectedState, webClient });
    expect(hasUnloadRisk()).toBe(true);

    act(() => autosave.scheduleSave());
    expect(hasUnloadRisk()).toBe(true);
    act(() => vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS));
    expect(hasUnloadRisk()).toBe(true);

    const requestId = vi.mocked(webClient.request.session.deckUpload).mock.calls[0][5];
    act(() => store.dispatch(server.Actions.deckUpload({
      path: '',
      requestId,
      treeItem: create(ServerInfo_DeckStorage_TreeItemSchema, { id: 7, name: 'Draft' }),
    })));
    expect(onStored).toHaveBeenCalledWith(7, expect.any(String));
    deleteDraft('draft');
    expect(hasUnloadRisk()).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});
