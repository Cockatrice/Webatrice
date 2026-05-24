import { vi } from 'vitest';
import { waitFor, act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({
  testConnection: vi.fn(),
}));

vi.mock('@app/services', () => ({
  dexieService: { testConnection: hoisted.testConnection },
}));

import FeatureDetection from './FeatureDetection';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('FeatureDetection', () => {
  beforeEach(() => {
    hoisted.testConnection.mockReset();
  });

  it('renders nothing and stays put when IndexedDB is available', async () => {
    hoisted.testConnection.mockResolvedValue(undefined);

    const { container } = renderWithProviders(<FeatureDetection />, {
      preloadedState: disconnectedState,
      route: '/',
    });
    await flush();

    expect(hoisted.testConnection).toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('navigates to the unsupported route when IndexedDB detection rejects', async () => {
    hoisted.testConnection.mockRejectedValue(new Error('no indexeddb'));

    renderWithProviders(
      <Routes>
        <Route path="/" element={<FeatureDetection />} />
        <Route path="/unsupported" element={<div>unsupported-page</div>} />
      </Routes>,
      { preloadedState: disconnectedState, route: '/' },
    );

    await waitFor(() => {
      expect(screen.getByText('unsupported-page')).toBeInTheDocument();
    });
  });
});
