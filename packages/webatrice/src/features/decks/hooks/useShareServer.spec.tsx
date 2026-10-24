import { act } from '@testing-library/react';
import { connected31State, createMockWebClient, renderWithProviders } from '../../../__test-utils__';
import { useDeckShareCreate, useShareServer } from './useDeckSharing';

vi.mock('@app/feature-widgets/known-hosts', () => ({
  useKnownHosts: () => ({ value: { selectedHost: { host: 'selected.example', port: '5748', desktopPort: '9999' },
    hosts: [
      { host: 'live.example:5748/server-b', port: '5748', desktopPort: '8888' },
      { host: 'live.example:5748/server-a', port: '5748', desktopPort: '4747' },
    ] } }),
}));

let endpoint: ReturnType<typeof useShareServer>;
let sharing: ReturnType<typeof useDeckShareCreate>;
function Probe() {
  endpoint = useShareServer();
  sharing = useDeckShareCreate();
  return null;
}

describe('live share server', () => {
  it('uses the live WebSocket port and path, independent of the selected host', () => {
    const webClient = createMockWebClient();
    Object.assign(webClient, { socket: { connectedEndpoint: 'wss://live.example:5748/server-a' } });
    renderWithProviders(<Probe />, { preloadedState: connected31State, webClient });
    expect(endpoint).toEqual({ hostname: 'wss://live.example:5748/server-a', port: '5748', desktopPort: '4747' });
  });

  it.each(['wss://live.example:6748/server-a', 'wss://live.example:5748/other-path'])(
    'does not borrow a desktop port from another endpoint: %s', (connectedEndpoint) => {
      const webClient = createMockWebClient();
      Object.assign(webClient, { socket: { connectedEndpoint } });
      renderWithProviders(<Probe />, { preloadedState: connected31State, webClient });
      expect(endpoint?.desktopPort).toBeUndefined();
    },
  );

  it('refuses creation without a live endpoint even when a host is selected', () => {
    const webClient = createMockWebClient();
    Object.assign(webClient, { socket: { connectedEndpoint: null } });
    renderWithProviders(<Probe />, { preloadedState: connected31State, webClient });
    act(() => sharing.create({ name: 'test', items: [{ deckId: 1 }] }));
    expect(webClient.request.session.deckShareCreate).not.toHaveBeenCalled();
    expect(endpoint).toBeNull();
  });
});
