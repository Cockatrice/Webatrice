import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { WebClientContext } from '@cockatrice/datatrice/react';
import { createMockWebClient } from '../__test-utils__/mockWebClient';

const mockDispatch = vi.hoisted(() => vi.fn());

vi.mock('@app/store', () => ({
  useAppDispatch: () => mockDispatch,
  GameActions: {
    gameLeft: ({ gameId }: { gameId: number }) => ({
      type: 'games/gameLeft',
      payload: { gameId },
    }),
  },
}));

import { useLeaveGame } from './useLeaveGame';

describe('useLeaveGame', () => {
  beforeEach(() => {
    mockDispatch.mockReset();
  });

  it('sends Command_LeaveGame and optimistically dispatches gameLeft, in that order', () => {
    const webClient = createMockWebClient();
    const order: string[] = [];
    vi.mocked(webClient.request.game.leaveGame).mockImplementation(() => {
      order.push('request');
    });
    mockDispatch.mockImplementation(() => {
      order.push('dispatch');
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <WebClientContext value={webClient}>{children}</WebClientContext>
    );

    const { result } = renderHook(() => useLeaveGame(), { wrapper });

    result.current(42);

    expect(webClient.request.game.leaveGame).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.leaveGame).toHaveBeenCalledWith(42);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'games/gameLeft',
      payload: { gameId: 42 },
    });
    expect(order).toEqual(['request', 'dispatch']);
  });

  it('passes the same gameId to both calls on each invocation', () => {
    const webClient = createMockWebClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <WebClientContext value={webClient}>{children}</WebClientContext>
    );

    const { result } = renderHook(() => useLeaveGame(), { wrapper });

    result.current(7);
    result.current(99);

    expect(webClient.request.game.leaveGame).toHaveBeenNthCalledWith(1, 7);
    expect(mockDispatch).toHaveBeenNthCalledWith(1, {
      type: 'games/gameLeft',
      payload: { gameId: 7 },
    });
    expect(webClient.request.game.leaveGame).toHaveBeenNthCalledWith(2, 99);
    expect(mockDispatch).toHaveBeenNthCalledWith(2, {
      type: 'games/gameLeft',
      payload: { gameId: 99 },
    });
  });
});
