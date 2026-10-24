import { act, renderHook, waitFor } from '@testing-library/react';

import { countStoredRecords, estimateStorage, isStoragePersisted, Stores } from '@app/services';

import { refreshStorageStatus, resetStorageStatus, useStorageStatus } from './useStorageStatus';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  estimateStorage: vi.fn(),
  countStoredRecords: vi.fn(),
  isStoragePersisted: vi.fn(),
}));

type Counts = Awaited<ReturnType<typeof countStoredRecords>>;

describe('useStorageStatus', () => {
  beforeEach(() => {
    resetStorageStatus();
    vi.mocked(estimateStorage).mockResolvedValue(null);
    vi.mocked(isStoragePersisted).mockResolvedValue(false);
    vi.mocked(countStoredRecords).mockResolvedValue({ [Stores.CARDS]: 0 } as Counts);
  });

  test('refreshes on a later visit after cards were imported, sharing one read per visit', async () => {
    const first = renderHook(() => useStorageStatus());
    await waitFor(() => expect(first.result.current.loaded).toBe(true));
    const sibling = renderHook(() => useStorageStatus());
    expect(countStoredRecords).toHaveBeenCalledTimes(1);
    first.unmount();
    sibling.unmount();
    vi.mocked(countStoredRecords).mockResolvedValue({ [Stores.CARDS]: 42 } as Counts);

    const second = renderHook(() => useStorageStatus());
    await waitFor(() => expect(second.result.current.counts[Stores.CARDS]).toBe(42));
    expect(countStoredRecords).toHaveBeenCalledTimes(2);
  });

  test.each(['estimate', 'counts', 'persisted'])('retains successful results when %s fails', async (failure) => {
    vi.mocked(estimateStorage).mockResolvedValue({ usage: 100, quota: 1000 });
    vi.mocked(countStoredRecords).mockResolvedValue({ [Stores.CARDS]: 42 } as Counts);
    vi.mocked(isStoragePersisted).mockResolvedValue(true);
    const error = new Error('Unavailable');
    if (failure === 'estimate') {
      vi.mocked(estimateStorage).mockRejectedValue(error);
    }
    if (failure === 'counts') {
      vi.mocked(countStoredRecords).mockRejectedValue(error);
    }
    if (failure === 'persisted') {
      vi.mocked(isStoragePersisted).mockRejectedValue(error);
    }

    const { result } = renderHook(() => useStorageStatus());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.usage).toEqual(failure === 'estimate' ? null : { usage: 100, quota: 1000 });
    expect(result.current.counts).toEqual(failure === 'counts' ? {} : { [Stores.CARDS]: 42 });
    expect(result.current.persisted).toBe(failure === 'persisted' ? null : true);
  });

  test('a refresh after a clear is not answered by a read that started before it', async () => {
    let finishMountRead: (counts: Counts) => void = () => {};
    vi.mocked(countStoredRecords)
      .mockReturnValueOnce(new Promise((resolve) => {
        finishMountRead = resolve;
      }))
      .mockResolvedValueOnce({ [Stores.SCRYFALL_CACHE]: 0 } as Counts);

    const { result } = renderHook(() => useStorageStatus());
    await act(() => refreshStorageStatus());
    expect(result.current.counts[Stores.SCRYFALL_CACHE]).toBe(0);

    await act(async () => finishMountRead({ [Stores.SCRYFALL_CACHE]: 12 } as Counts));
    expect(result.current.counts[Stores.SCRYFALL_CACHE]).toBe(0);
  });
});
