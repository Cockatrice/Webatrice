import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@app/services', () => ({
  CardDTO: { get: vi.fn() },
  TokenDTO: { get: vi.fn() },
}));

import { CardDTO, TokenDTO } from '@app/services';
import { useCardCallout } from './useCardCallout';

describe('useCardCallout', () => {
  it('returns nullish state and open=false on first render', () => {
    vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
    vi.mocked(TokenDTO.get).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useCardCallout('Lightning Bolt'));

    expect(result.current.card).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.anchorEl).toBeNull();
    expect(result.current.open).toBe(false);
  });

  it('hydrates the card slot when CardDTO.get resolves', async () => {
    const card = { name: 'Lightning Bolt' };
    vi.mocked(CardDTO.get).mockResolvedValue(card as never);
    vi.mocked(TokenDTO.get).mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useCardCallout('Lightning Bolt'));

    await waitFor(() => {
      expect(result.current.card).toBe(card);
    });
    expect(result.current.token).toBeNull();
  });

  it('falls back to TokenDTO when no card is found', async () => {
    const token = { name: 'Saproling' };
    vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
    vi.mocked(TokenDTO.get).mockResolvedValue(token as never);

    const { result } = renderHook(() => useCardCallout('Saproling'));

    await waitFor(() => {
      expect(result.current.token).toBe(token);
    });
    expect(result.current.card).toBeNull();
  });

  it('handlePopoverOpen sets the anchor and flips open=true', () => {
    vi.mocked(CardDTO.get).mockResolvedValue(undefined as never);
    vi.mocked(TokenDTO.get).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useCardCallout('x'));

    const target = document.createElement('span');
    act(() => {
      result.current.handlePopoverOpen({ currentTarget: target } as never);
    });
    expect(result.current.anchorEl).toBe(target);
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.handlePopoverClose();
    });
    expect(result.current.anchorEl).toBeNull();
    expect(result.current.open).toBe(false);
  });
});
