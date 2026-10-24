import { act, renderHook, waitFor } from '@testing-library/react';

import { fetchScryfallDetail, type ScryfallDetail } from '@app/services';

import type { DeckCard } from '../types';
import { useCardDetail } from './useCardDetail';

vi.mock('@app/services', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@app/services')>()),
  fetchScryfallDetail: vi.fn(),
}));

const row: DeckCard = { name: 'Brisela', quantity: 1, category: 'main', lookupSource: 'scryfall', scryfallId: 'id-b' };
const detail = (name: string): ScryfallDetail => ({ id: name, name });

describe('useCardDetail', () => {
  it('fetches the clicked row by its printing', async () => {
    vi.mocked(fetchScryfallDetail).mockResolvedValue(detail('Brisela'));
    const { result } = renderHook(() => useCardDetail(row));

    expect(result.current.detailLoading).toBe(true);
    await waitFor(() => expect(result.current.detail?.name).toBe('Brisela'));
    expect(result.current.detailLoading).toBe(false);
    expect(vi.mocked(fetchScryfallDetail).mock.calls[0].slice(0, 2)).toEqual(['id-b', 'Brisela']);
  });

  it('browses to a related card only once its details arrive, and back again', async () => {
    vi.mocked(fetchScryfallDetail).mockResolvedValue(detail('Brisela'));
    const { result } = renderHook(() => useCardDetail(row));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    let resolveBrowse: (d: ScryfallDetail) => void = () => {};
    vi.mocked(fetchScryfallDetail).mockImplementationOnce(() => new Promise((resolve) => {
      resolveBrowse = resolve;
    }));
    act(() => result.current.browse({ name: 'Gisela', kind: 'meld_part' }));
    expect(result.current.pending).toEqual({ name: 'Gisela', scryfallId: undefined });
    expect(result.current.browsed).toBeNull();

    vi.mocked(fetchScryfallDetail).mockResolvedValue(detail('Gisela'));
    await act(async () => resolveBrowse(detail('Gisela')));
    expect(result.current.browsed).toEqual({ name: 'Gisela', kind: 'meld_part' });
    expect(result.current.detail?.name).toBe('Gisela');
    expect(result.current.pending).toBeNull();

    act(() => result.current.back());
    expect(result.current.browsed).toBeNull();
  });

  it('drops a browse superseded by a newer click', async () => {
    vi.mocked(fetchScryfallDetail).mockResolvedValue(detail('Brisela'));
    const { result } = renderHook(() => useCardDetail(row));
    await waitFor(() => expect(result.current.detail).not.toBeNull());

    let resolveFirst: (d: ScryfallDetail) => void = () => {};
    vi.mocked(fetchScryfallDetail)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValue(detail('Bruna'));
    act(() => result.current.browse({ name: 'Gisela', kind: 'meld_part' }));
    act(() => result.current.browse({ name: 'Bruna', kind: 'meld_part' }));
    await waitFor(() => expect(result.current.browsed?.name).toBe('Bruna'));

    await act(async () => resolveFirst(detail('Gisela')));
    expect(result.current.browsed?.name).toBe('Bruna');
  });

  it('starts fresh when another row is opened', async () => {
    vi.mocked(fetchScryfallDetail).mockResolvedValue(detail('X'));
    const { result, rerender } = renderHook(({ snapshot }) => useCardDetail(snapshot), {
      initialProps: { snapshot: row as DeckCard | null },
    });
    await waitFor(() => expect(result.current.detail).not.toBeNull());
    act(() => result.current.browse({ name: 'Gisela', kind: 'meld_part' }));
    await waitFor(() => expect(result.current.browsed).not.toBeNull());

    rerender({ snapshot: { ...row, name: 'Other' } });
    expect(result.current.browsed).toBeNull();

    rerender({ snapshot: null });
    expect(result.current.detail).toBeNull();
  });
});
