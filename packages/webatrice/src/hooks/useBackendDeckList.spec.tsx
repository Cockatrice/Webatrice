import { act } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { server } from '@cockatrice/datatrice';
import { Response_DeckListSchema } from '@cockatrice/sockatrice/generated';
import { connectedState, disconnectedState, createMockWebClient, renderWithProviders } from '../__test-utils__';
import { useBackendDeckList } from './useBackendDeckList';

let latest: ReturnType<typeof useBackendDeckList>;
function Probe({ beforeRequest }: { beforeRequest: () => void }) {
  latest = useBackendDeckList({ beforeRequest });
  return null;
}

describe('useBackendDeckList', () => {
  it('requests once, retains nested server names, and refreshes through the same port', () => {
    const webClient = createMockWebClient();
    const beforeRequest = vi.fn();
    const { store, rerender } = renderWithProviders(<Probe beforeRequest={beforeRequest} />, {
      webClient, preloadedState: connectedState,
    });
    expect(latest.loading).toBe(true);
    expect(webClient.request.session.deckList).toHaveBeenCalledTimes(1);
    act(() => store.dispatch(server.Actions.backendDecks({ deckList: create(Response_DeckListSchema, {
      root: { items: [
        { id: 1, name: '  Original Name  ', file: {} },
        { name: 'Folder', folder: { items: [{ id: 2, name: 'Nested', file: {} }, { id: 3, name: 'Empty' }] } },
      ] },
    }) })));
    expect(latest.decks).toEqual([{ id: 1, name: '  Original Name  ' }, { id: 2, name: 'Nested' }]);
    expect(latest.loading).toBe(false);
    rerender(<Probe beforeRequest={beforeRequest} />);
    expect(webClient.request.session.deckList).toHaveBeenCalledTimes(1);
    act(() => latest.refresh());
    expect(beforeRequest).toHaveBeenCalledTimes(2);
    expect(webClient.request.session.deckList).toHaveBeenCalledTimes(2);
  });

  it('does not request or invalidate consumer caches while disconnected', () => {
    const webClient = createMockWebClient();
    const beforeRequest = vi.fn();
    renderWithProviders(<Probe beforeRequest={beforeRequest} />, { webClient, preloadedState: disconnectedState });
    act(() => latest.refresh());
    expect(latest.decks).toEqual([]);
    expect(beforeRequest).not.toHaveBeenCalled();
    expect(webClient.request.session.deckList).not.toHaveBeenCalled();
  });
});
