import { act } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';
import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useLobbyDeckSummaries } from './useLobbyDeckSummaries';

let latest: ReturnType<typeof useLobbyDeckSummaries>;
const decks = [{ id: 7101, name: 'Stored' }, { id: 7102, name: 'Malformed' }];
function Probe({ connected = true }: { connected?: boolean }) {
  latest = useLobbyDeckSummaries(decks, connected);
  return null;
}

describe('useLobbyDeckSummaries', () => {
  it('waits for connection, deduplicates downloads and retains successful and malformed summaries on remount', () => {
    const webClient = createMockWebClient();
    const options = { webClient, preloadedState: connectedState };
    const first = renderWithProviders(<Probe connected={false} />, options);
    expect(webClient.request.session.deckDownload).not.toHaveBeenCalled();
    first.rerender(<Probe />);
    expect(vi.mocked(webClient.request.session.deckDownload).mock.calls).toEqual([[7101], [7102]]);
    first.rerender(<Probe />);
    expect(webClient.request.session.deckDownload).toHaveBeenCalledTimes(2);
    expect(latest.stillLoadingFormats).toBe(true);
    act(() => {
      first.store.dispatch(server.Actions.deckDownloaded({ deckId: 7101, deck:
        '<cockatrice_deck><deckname>Original</deckname><format>commander</format>'
        + '<comments>{"v":1,"bracketLevel":2}</comments></cockatrice_deck>',
      }));
      first.store.dispatch(server.Actions.deckDownloaded({ deckId: 7102, deck: '<invalid/>' }));
    });
    expect(latest.summaryByDeckId.get(7101)).toEqual({ name: 'Original', format: 'commander', bracketLevel: 2 });
    expect(latest.summaryByDeckId.get(7102)).toEqual({ name: '', format: '', bracketLevel: undefined });
    expect(latest.bracketByDeckId.get(7101)).toBe(2);
    expect(latest.stillLoadingFormats).toBe(false);
    const previous = latest.summaryByDeckId;
    act(() => first.store.dispatch(server.Actions.deckDownloaded({ deckId: 7102, deck: '<invalid/>' })));
    expect(latest.summaryByDeckId).toBe(previous);
    first.unmount();
    renderWithProviders(<Probe />, options);
    expect(latest.summaryByDeckId.get(7101)?.name).toBe('Original');
    expect(latest.stillLoadingFormats).toBe(false);
    expect(webClient.request.session.deckDownload).toHaveBeenCalledTimes(2);
  });
});
