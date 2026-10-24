import { connectedState, createMockWebClient, disconnectedState, renderWithProviders } from '../../__test-utils__';

import { useLiveServerEndpoint } from './useLiveServerEndpoint';

const knownHosts = vi.hoisted(() => ({
  value: {
    selectedHost: { host: 'selected.example', port: '9999', desktopPort: '9998' },
    hosts: [
      { host: 'live.example:5748/server-b', port: '5748', desktopPort: '8888' },
      { host: 'live.example:5748/server-a', port: '5748', desktopPort: '4747' },
    ],
  },
}));

vi.mock('./useKnownHosts', () => ({
  useKnownHosts: () => knownHosts,
}));

let endpoint: ReturnType<typeof useLiveServerEndpoint>;

function Probe() {
  endpoint = useLiveServerEndpoint();
  return null;
}

describe('useLiveServerEndpoint', () => {
  it('maps the exact live endpoint independently of the selected host', () => {
    const webClient = createMockWebClient();
    Object.assign(webClient, { socket: { connectedEndpoint: 'wss://live.example:5748/server-a' } });
    renderWithProviders(<Probe />, { preloadedState: connectedState, webClient });
    expect(endpoint).toEqual({ hostname: 'live.example', port: '5748', desktopPort: '4747' });
  });

  it('does not borrow a desktop port from another path on the same host', () => {
    const webClient = createMockWebClient();
    Object.assign(webClient, { socket: { connectedEndpoint: 'wss://live.example:5748/other-path' } });
    renderWithProviders(<Probe />, { preloadedState: connectedState, webClient });
    expect(endpoint).toEqual({ hostname: 'live.example', port: '5748', desktopPort: undefined });
  });

  it('fails closed while disconnected even if the socket retains an endpoint', () => {
    const webClient = createMockWebClient();
    Object.assign(webClient, { socket: { connectedEndpoint: 'wss://live.example:5748/server-a' } });
    renderWithProviders(<Probe />, { preloadedState: disconnectedState, webClient });
    expect(endpoint).toBeNull();
  });
});
