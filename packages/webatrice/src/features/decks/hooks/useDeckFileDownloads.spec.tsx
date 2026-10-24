import { act } from '@testing-library/react';

import { server } from '@cockatrice/datatrice';

import { connectedState, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { saveTextFile } from '../browserHandoff';
import { deckFileName, useDeckFileDownloads } from './useDeckFileDownloads';

vi.mock('../browserHandoff', () => ({ saveTextFile: vi.fn() }));

let latest: ReturnType<typeof useDeckFileDownloads>;
function Probe() {
  latest = useDeckFileDownloads();
  return null;
}

const burn = { id: 3, name: 'Burn', path: 'Modern', creationTime: 0, visibility: 'private' as const };
const affinity = { id: 4, name: 'Affinity', path: 'Modern/Old', creationTime: 0, visibility: 'private' as const };

describe('deckFileName', () => {
  it('prefixes the folders below the downloaded one', () => {
    expect(deckFileName(burn, 'Modern')).toBe('burn.cod');
    expect(deckFileName(affinity, 'Modern')).toBe('old-affinity.cod');
    expect(deckFileName(affinity, '')).toBe('modern-old-affinity.cod');
    expect(deckFileName({ ...burn, path: 'Modern2' }, 'Modern')).toBe('modern2-burn.cod');
  });
});

describe('useDeckFileDownloads', () => {
  it('downloads each deck and saves the requested ones as .cod files', () => {
    const webClient = createMockWebClient();
    const { store } = renderWithProviders(<Probe />, { preloadedState: connectedState, webClient });

    act(() => latest.download([burn, affinity], 'Modern'));
    expect(vi.mocked(webClient.request.session.deckDownload).mock.calls).toEqual([[3], [4]]);

    act(() => {
      store.dispatch(server.Actions.deckDownloaded({ deckId: 4, deck: '<a/>' }));
      store.dispatch(server.Actions.deckDownloaded({ deckId: 99, deck: '<other/>' }));
      store.dispatch(server.Actions.deckDownloaded({ deckId: 4, deck: '<again/>' }));
    });
    expect(vi.mocked(saveTextFile).mock.calls).toEqual([['old-affinity.cod', '<a/>', 'application/xml']]);
  });
});
