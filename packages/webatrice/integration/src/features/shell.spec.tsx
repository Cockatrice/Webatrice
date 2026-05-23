import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { Initialize, Unsupported, FeatureDetection } from '@app/features/shell';
import { dexieService } from '@app/services';
import { server } from '@cockatrice/datatrice';

import { renderFeatureScreen, store } from './helpers';

beforeEach(() => {
  vi.useRealTimers();
});

describe('Initialize (integration)', () => {
  it('renders the splash screen while the server has not initialized', () => {
    // setup.ts's afterEach calls clearStore between tests, but other spec
    // files that run earlier may have left the singleton store with
    // initialized=true (any handshake event sets it). Reset explicitly.
    store.dispatch(server.Actions.clearStore());

    renderFeatureScreen(<Initialize />, '/');

    expect(screen.getByText('Initialize.title')).toBeInTheDocument();
  });

  it('navigates to /login once the store reports the server as initialized', () => {
    store.dispatch(server.Actions.initialized());

    renderFeatureScreen(<Initialize />, '/');

    // Initialize <Navigate to="/login" />s without rendering the splash content.
    expect(screen.queryByText('Initialize.title')).toBeNull();
  });
});

describe('Unsupported (integration)', () => {
  it('renders the unsupported-browser messaging', () => {
    renderFeatureScreen(<Unsupported />, '/');

    expect(screen.getByText('Unsupported.title')).toBeInTheDocument();
  });
});

describe('FeatureDetection (integration)', () => {
  it('calls dexieService.testConnection on mount', async () => {
    const spy = vi.spyOn(dexieService, 'testConnection').mockResolvedValue(undefined);

    renderFeatureScreen(<FeatureDetection />, '/');

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });
  });
});
