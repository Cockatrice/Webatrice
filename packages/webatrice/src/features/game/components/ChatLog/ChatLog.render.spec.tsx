import { act, fireEvent, screen } from '@testing-library/react';
import type { GameLogRowsProps } from '@app/feature-widgets/replay-player';

import { renderWithProviders } from '../../../../__test-utils__';
import { buildSeatGameState } from '../../__test-utils__/seatFixtures';
import { GameIdProvider } from '../ui/GameIdContext';
import ChatLog from './ChatLog';

const harness = vi.hoisted(() => ({
  renderRows: vi.fn((_props: GameLogRowsProps) => null),
}));

vi.mock('@app/feature-widgets/replay-player', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/feature-widgets/replay-player')>();
  const { memo } = await import('react');
  return {
    ...actual,
    GameLogRows: memo(harness.renderRows),
  };
});

describe('ChatLog render stability', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the memoized row-list props stable while the chat draft and clock change', () => {
    vi.useFakeTimers();
    const preloadedState = buildSeatGameState({ localPlayerId: 1, seats: [{ playerId: 1, name: 'Alice' }] });
    preloadedState.games!.games![1]!.messages = [
      { playerId: 1, message: 'gg', kind: 'chat', senderName: 'Alice', timeReceived: 0 },
    ];
    renderWithProviders(
      <GameIdProvider value={1}>
        <ChatLog />
      </GameIdProvider>,
      { preloadedState },
    );
    expect(harness.renderRows).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('combobox', { name: 'ChatLog.inputLabel' }), {
      target: { value: 'draft' },
    });

    expect(harness.renderRows).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('game-log-timer')).toHaveTextContent('00:00:01');
    expect(harness.renderRows).toHaveBeenCalledTimes(1);
  });
});
