import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  clearCardData,
  clearScryfallCache,
  countStoredRecords,
  estimateStorage,
  isStoragePersisted,
  requestPersistentStorage,
  Stores,
} from '@app/services';

import {
  ClearCardDataControl,
  ClearScryfallCacheControl,
  formatBytes,
  PersistentStorageControl,
  StorageUsageControl,
} from './StorageControls';
import { resetStorageStatus } from './useStorageStatus';

const hoisted = vi.hoisted(() => ({ refreshCardDataPreferences: vi.fn() }));

vi.mock('@app/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/hooks')>()),
  refreshCardDataPreferences: hoisted.refreshCardDataPreferences,
}));

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  estimateStorage: vi.fn(),
  countStoredRecords: vi.fn(),
  isStoragePersisted: vi.fn(),
  requestPersistentStorage: vi.fn(),
  isPersistentStorageSupported: () => true,
  clearScryfallCache: vi.fn(),
  clearCardData: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key),
    i18n: { language: 'en_US' },
  }),
}));

const props = { id: 'control', labelId: 'label', disabled: false };

const counts = (overrides: Partial<Record<Stores, number>> = {}) => ({
  [Stores.CARDS]: 0,
  [Stores.SETS]: 0,
  [Stores.TOKENS]: 0,
  [Stores.FORMATS]: 0,
  [Stores.INFO]: 0,
  [Stores.CARD_SOURCES]: 0,
  [Stores.CARD_SOURCE_PAYLOADS]: 0,
  [Stores.SET_PREFERENCES]: 0,
  [Stores.CARD_DATA_SETTINGS]: 0,
  [Stores.SCRYFALL_CACHE]: 0,
  [Stores.REPLAYS]: 0,
  [Stores.REPLAY_DATA]: 0,
  [Stores.HOSTS]: 0,
  [Stores.SETTINGS]: 1,
  ...overrides,
});

describe('Storage controls', () => {
  beforeEach(() => {
    resetStorageStatus();
    vi.mocked(estimateStorage).mockResolvedValue({ usage: 3 * 1024 * 1024, quota: 2 * 1024 * 1024 * 1024 });
    vi.mocked(countStoredRecords).mockResolvedValue(counts({ [Stores.CARDS]: 31_000, [Stores.SCRYFALL_CACHE]: 12 }));
    vi.mocked(isStoragePersisted).mockResolvedValue(false);
    vi.mocked(clearScryfallCache).mockResolvedValue();
    vi.mocked(clearCardData).mockResolvedValue();
    hoisted.refreshCardDataPreferences.mockResolvedValue(undefined);
  });

  test('formats byte counts in the largest whole unit', () => {
    expect(formatBytes(512, 'en_US')).toBe('512 byte');
    expect(formatBytes(3 * 1024 * 1024, 'en_US')).toBe('3 MB');
    expect(formatBytes(1.5 * 1024 ** 3, 'en_US')).toBe('1.5 GB');
  });

  test('shows the browser estimate and every table count', async () => {
    render(<StorageUsageControl {...props} />);

    expect(await screen.findByText(/SettingsStorage\.usage\.value/)).toHaveTextContent('"used":"3 MB","quota":"2 GB"');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('SettingsStorage.table.cards').nextSibling).toHaveTextContent('31,000');
    expect(screen.getByText('SettingsStorage.table.cardSources')).toBeInTheDocument();
    expect(screen.getByText('SettingsStorage.table.setPreferences')).toBeInTheDocument();
    expect(screen.getByText('SettingsStorage.table.cardDataSettings')).toBeInTheDocument();
  });

  test('says so when the browser gives no estimate', async () => {
    vi.mocked(estimateStorage).mockResolvedValue(null);

    render(<StorageUsageControl {...props} />);

    expect(await screen.findByText('SettingsStorage.usage.unavailable')).toBeInTheDocument();
  });

  test('requests persistent storage and reports a refusal', async () => {
    vi.mocked(requestPersistentStorage).mockResolvedValue(false);
    render(<PersistentStorageControl {...props} />);
    await screen.findByText('SettingsStorage.persistent.status.default');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /SettingsStorage\.persistent\.request/ }));
    });

    expect(requestPersistentStorage).toHaveBeenCalled();
    expect(screen.getByText('SettingsStorage.persistent.status.refused')).toBeInTheDocument();
  });

  test('hides the request once storage is persistent', async () => {
    vi.mocked(isStoragePersisted).mockResolvedValue(true);

    render(<PersistentStorageControl {...props} />);

    expect(await screen.findByText('SettingsStorage.persistent.status.granted')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('clears the Scryfall cache straight away and refreshes the figures', async () => {
    render(<ClearScryfallCacheControl {...props} />);
    const button = await screen.findByRole('button', { name: /SettingsStorage\.scryfallCache\.button/ });
    await waitFor(() => expect(button).toBeEnabled());
    vi.mocked(countStoredRecords).mockResolvedValue(counts({ [Stores.CARDS]: 31_000 }));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(clearScryfallCache).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/SettingsStorage\.scryfallCache\.count/)).toHaveTextContent('"count":0');
    expect(button).toBeDisabled();
  });

  test('asks before deleting the card database', async () => {
    render(<ClearCardDataControl {...props} />);
    const button = await screen.findByRole('button', { name: /SettingsStorage\.cardData\.button/ });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);
    expect(clearCardData).not.toHaveBeenCalled();
    expect(screen.getByText('SettingsStorage.cardData.confirm.message')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SettingsStorage.cancel' }));
    expect(clearCardData).not.toHaveBeenCalled();

    fireEvent.click(button);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'SettingsStorage.cardData.button' }).at(-1)!);
    });

    expect(clearCardData).toHaveBeenCalledTimes(1);
    expect(hoisted.refreshCardDataPreferences).toHaveBeenCalledTimes(1);
  });

  test('counts the loaded card files with the card database', async () => {
    vi.mocked(countStoredRecords).mockResolvedValue(counts({ [Stores.CARD_SOURCES]: 2, [Stores.SET_PREFERENCES]: 40 }));
    render(<ClearCardDataControl {...props} />);

    expect(await screen.findByText(/SettingsStorage\.cardData\.count/)).toHaveTextContent('"count":2');
  });

  test('reports a failed clear', async () => {
    vi.mocked(clearScryfallCache).mockRejectedValue(new Error('blocked'));
    render(<ClearScryfallCacheControl {...props} />);
    const button = await screen.findByRole('button', { name: /SettingsStorage\.scryfallCache\.button/ });
    await waitFor(() => expect(button).toBeEnabled());

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText('SettingsStorage.clearFailed')).toBeInTheDocument();
  });
});
