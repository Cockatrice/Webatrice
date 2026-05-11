import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { WebClientContext } from './useWebClient';
import { createMockWebClient } from '../__test-utils__/mockWebClient';

vi.mock('@app/store', () => ({
  GameDispatch: {
    gameLeft: vi.fn(),
  },
}));

import { GameDispatch } from '@app/store';
import { useLeaveGame } from './useLeaveGame';

describe('useLeaveGame', () => {
  it('sends Command_LeaveGame and optimistically dispatches gameLeft, in that order', () => {
    const webClient = createMockWebClient();
    const order: string[] = [];
    vi.mocked(webClient.request.game.leaveGame).mockImplementation(() => {
      order.push('request');
    });
    vi.mocked(GameDispatch.gameLeft).mockImplementation(() => {
      order.push('dispatch');
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <WebClientContext value={webClient}>{children}</WebClientContext>
    );

    const { result } = renderHook(() => useLeaveGame(), { wrapper });

    result.current(42);

    expect(webClient.request.game.leaveGame).toHaveBeenCalledTimes(1);
    expect(webClient.request.game.leaveGame).toHaveBeenCalledWith(42);
    expect(GameDispatch.gameLeft).toHaveBeenCalledTimes(1);
    expect(GameDispatch.gameLeft).toHaveBeenCalledWith(42);
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
    expect(GameDispatch.gameLeft).toHaveBeenNthCalledWith(1, 7);
    expect(webClient.request.game.leaveGame).toHaveBeenNthCalledWith(2, 99);
    expect(GameDispatch.gameLeft).toHaveBeenNthCalledWith(2, 99);
  });
});
