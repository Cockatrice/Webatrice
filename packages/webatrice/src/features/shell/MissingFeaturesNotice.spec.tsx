import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { server } from '@cockatrice/datatrice';

const hoisted = vi.hoisted(() => ({ notify: true, useKnownHosts: vi.fn() }));

vi.mock('@app/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/hooks')>();
  return {
    ...actual,
    getPreferencesSnapshot: () => ({ ...actual.getPreferencesSnapshot(), notifyAboutMissingFeatures: hoisted.notify }),
  };
});
vi.mock('@app/feature-widgets/known-hosts', () => ({ useKnownHosts: hoisted.useKnownHosts }));

import { renderWithProviders, connectedState } from '../../__test-utils__';
import { makeHost, makeKnownHostsHook } from '../../feature-widgets/known-hosts/__mocks__/useKnownHosts';
import MissingFeaturesNotice, { notifiedServers } from './MissingFeaturesNotice';

function selectHost(host: string) {
  const selected = makeHost({ host, port: '4748' });
  hoisted.useKnownHosts.mockReturnValue(makeKnownHostsHook({ value: { hosts: [selected], selectedHost: selected } }));
}

function renderNotice() {
  return renderWithProviders(<MissingFeaturesNotice />, { preloadedState: connectedState });
}

function logIn(store: ReturnType<typeof renderNotice>['store'], missingFeatures?: string[]) {
  act(() => {
    store.dispatch(server.Actions.loginSuccessful({ options: { missingFeatures } }));
  });
}

describe('MissingFeaturesNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notifiedServers.clear();
    hoisted.notify = true;
    selectHost('a.example');
  });

  it('tells the user when the server supports features this client lacks', () => {
    const { store } = renderNotice();

    logIn(store, ['new_feature']);

    expect(screen.getByRole('dialog')).toHaveTextContent('MissingFeaturesNotice.title');
    expect(screen.getByText('MissingFeaturesNotice.message')).toBeInTheDocument();
  });

  it('says nothing when nothing is missing', () => {
    const { store } = renderNotice();

    logIn(store, []);
    logIn(store, undefined);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says nothing while the setting is off', () => {
    hoisted.notify = false;
    const { store } = renderNotice();

    logIn(store, ['new_feature']);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('tells the user once per server, and again for another server', async () => {
    const first = renderNotice();
    logIn(first.store, ['new_feature']);
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    logIn(first.store, ['new_feature']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    first.unmount();

    selectHost('b.example');
    const other = renderNotice();
    logIn(other.store, ['new_feature']);
    expect(screen.getByRole('dialog')).toHaveTextContent('MissingFeaturesNotice.title');
  });
});
