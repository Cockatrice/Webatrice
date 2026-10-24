import { act, renderHook, waitFor } from '@testing-library/react';

const hoisted = vi.hoisted(() => ({
  setCardOverride: vi.fn(),
  refresh: vi.fn(),
  preferences: { value: { cardOverrides: { Bolt: 'pinned' } } } as {
    value: { cardOverrides: Record<string, string> };
  },
}));

vi.mock('../services/dexie/DexieDTOs/CardDataSettingsDTO', () => ({
  CardDataSettingsDTO: { setCardOverride: hoisted.setCardOverride },
}));
vi.mock('./useCardDataPreferences', () => ({
  refreshCardDataPreferences: hoisted.refresh,
  useCardDataPreferences: () => hoisted.preferences,
}));

import { useCardOverride } from './useCardOverride';

describe('useCardOverride', () => {
  it('reads exact names and toggles persistence before refreshing preferences', async () => {
    const { result, rerender } = renderHook(({ name }) => useCardOverride(name), {
      initialProps: { name: 'Bolt' },
    });
    expect(result.current.pinnedPrintingId).toBe('pinned');
    rerender({ name: 'bolt' });
    expect(result.current.pinnedPrintingId).toBeUndefined();
    rerender({ name: 'Bolt' });

    const order: string[] = [];
    hoisted.setCardOverride.mockImplementationOnce(async () => {
      order.push('persist');
    });
    hoisted.refresh.mockImplementationOnce(async () => {
      order.push('refresh');
    });
    await act(() => result.current.togglePin('pinned'));

    expect(hoisted.setCardOverride).toHaveBeenCalledWith('Bolt', undefined);
    expect(order).toEqual(['persist', 'refresh']);
  });

  it('exposes saving state until persistence and refresh finish', async () => {
    let finish: (() => void) | undefined;
    hoisted.setCardOverride.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    const { result } = renderHook(() => useCardOverride('Bolt'));

    let pending: Promise<void>;
    act(() => {
      pending = result.current.togglePin('different');
    });
    expect(result.current.savingPin).toBe(true);
    act(() => finish?.());
    await act(() => pending!);
    await waitFor(() => expect(result.current.savingPin).toBe(false));
    expect(hoisted.setCardOverride).toHaveBeenCalledWith('Bolt', 'different');
  });
});
