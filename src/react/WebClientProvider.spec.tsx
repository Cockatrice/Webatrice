import { render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { WebsocketTypes } from '@cockatrice/sockatrice/types';
import type { WebClient } from '@cockatrice/sockatrice';

import { DatatriceProvider } from './DatatriceProvider';
import { WebClientProvider, WebClientContext, useWebClient } from './WebClientProvider';

const TEST_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'test',
  clientver: 'test-1.0',
  clientfeatures: [],
};

const TEST_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: false,
  keepalive: 0,
};

// Minimal stub satisfying the bit of `WebClient`-shape the Provider hands
// to context. Tests never actually invoke methods — they assert identity
// or presence via the context.
const createStubClient = (): WebClient => ({} as WebClient);

describe('WebClientProvider', () => {
  it('uses the supplied client override instead of constructing a new WebClient', () => {
    const stub = createStubClient();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={stub}>
          {children}
        </WebClientProvider>
      </DatatriceProvider>
    );

    const { result } = renderHook(() => useWebClient(), { wrapper });
    expect(result.current).toBe(stub);
  });

  it('exposes the client via WebClientContext for direct consumers', () => {
    const stub = createStubClient();
    let captured: WebClient | null = null;

    function Probe() {
      return (
        <WebClientContext.Consumer>
          {(client) => {
            captured = client;
            return null;
          }}
        </WebClientContext.Consumer>
      );
    }

    render(
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={stub}>
          <Probe />
        </WebClientProvider>
      </DatatriceProvider>,
    );

    expect(captured).toBe(stub);
  });

  it('renders children inside the provider tree', () => {
    const stub = createStubClient();
    const { getByText } = render(
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={stub}>
          <span>inner</span>
        </WebClientProvider>
      </DatatriceProvider>,
    );
    expect(getByText('inner')).toBeDefined();
  });
});

describe('useWebClient', () => {
  it('throws when used outside a WebClientProvider', () => {
    // Suppress React's expected error-boundary console noise.
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => renderHook(() => useWebClient())).toThrow(
        'useWebClient must be used within a WebClientProvider',
      );
    } finally {
      console.error = original;
    }
  });

  it('returns the client when used inside a WebClientProvider', () => {
    const stub = createStubClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={stub}>
          {children}
        </WebClientProvider>
      </DatatriceProvider>
    );
    const { result } = renderHook(() => useWebClient(), { wrapper });
    expect(result.current).toBe(stub);
  });
});

describe('WebClientProvider edge cases', () => {
  it('nested WebClientProviders → inner client shadows the outer', () => {
    const outer = createStubClient();
    const inner = createStubClient();

    const wrapper = ({ children }: { children: ReactNode }) => (
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={outer}>
          <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={inner}>
            {children}
          </WebClientProvider>
        </WebClientProvider>
      </DatatriceProvider>
    );

    const { result } = renderHook(() => useWebClient(), { wrapper });
    expect(result.current).toBe(inner);
    expect(result.current).not.toBe(outer);
  });

  it('the client prop is memoized at mount → later changes are ignored', () => {
    const first = createStubClient();
    const second = createStubClient();
    expect(first).not.toBe(second);

    const wrapperWith = (client: WebClient) => ({ children }: { children: ReactNode }) => (
      <DatatriceProvider>
        <WebClientProvider config={TEST_CONFIG} options={TEST_OPTIONS} client={client}>
          {children}
        </WebClientProvider>
      </DatatriceProvider>
    );

    const { result, rerender } = renderHook(() => useWebClient(), {
      wrapper: wrapperWith(first),
    });
    expect(result.current).toBe(first);

    rerender({ wrapper: wrapperWith(second) } as never);
    // useState memoizes the client at mount; subsequent prop changes don't swap.
    expect(result.current).toBe(first);
  });
});
