import { vi } from 'vitest';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider } from 'react-i18next';
import { waitFor, act, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { renderWithProviders, disconnectedState } from '../../__test-utils__';

const hoisted = vi.hoisted(() => ({
  testConnection: vi.fn(),
  getBrowserSupport: vi.fn(),
  pushToast: vi.fn(),
}));

vi.mock('@app/services', async (importOriginal) => ({
  ...await importOriginal<typeof import('@app/services')>(),
  dexieService: { testConnection: hoisted.testConnection },
}));

vi.mock('@app/utils', () => ({
  getBrowserSupport: hoisted.getBrowserSupport,
}));

vi.mock('@app/components', () => ({
  usePushToast: () => hoisted.pushToast,
}));

import FeatureDetection from './FeatureDetection';
import featureMessages from './FeatureDetection.i18n.json';
import browserMessages from './BrowserFeature.i18n.json';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('FeatureDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.testConnection.mockResolvedValue(undefined);
    hoisted.getBrowserSupport.mockReturnValue({ missingRequired: [], missingOptional: [] });
  });

  it('renders nothing and stays put when IndexedDB is available', async () => {
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

  it('shows no notice when every optional feature is present', async () => {
    renderWithProviders(<FeatureDetection />, { preloadedState: disconnectedState, route: '/' });
    await flush();

    expect(hoisted.pushToast).not.toHaveBeenCalled();
  });

  it('names the missing optional features in one warning notice', async () => {
    hoisted.getBrowserSupport.mockReturnValue({
      missingRequired: [],
      missingOptional: ['worker', 'clipboard'],
    });

    const i18n = i18next.createInstance();
    await i18n.use(ICU).init({
      lng: 'en',
      resources: { en: { translation: { ...featureMessages, ...browserMessages } } },
      interpolation: { escapeValue: false },
    });
    renderWithProviders(
      <I18nextProvider i18n={i18n}><FeatureDetection /></I18nextProvider>,
      { preloadedState: disconnectedState, route: '/' },
    );
    await flush();

    expect(hoisted.pushToast).toHaveBeenCalledTimes(1);
    expect(hoisted.pushToast).toHaveBeenCalledWith(
      'Some features are unavailable in this browser: '
        + `${browserMessages.BrowserFeature.worker}; ${browserMessages.BrowserFeature.clipboard}.`,
      { severity: 'warning' },
    );
  });
});
