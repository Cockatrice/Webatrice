import { act, screen } from '@testing-library/react';
import type { GameMessage } from '@cockatrice/datatrice';

import { renderWithProviders } from '../../__test-utils__';
import { testI18n } from '../../__test-utils__/renderWithProviders';
import { GameLogRows } from './GameLogRows';

const first: GameMessage = {
  kind: 'chat',
  playerId: 1,
  senderName: 'Alice',
  message: 'first',
  timeReceived: new Date(2026, 9, 3, 14, 3, 9).getTime(),
};
const second: GameMessage = {
  kind: 'chat',
  playerId: 2,
  senderName: 'Bob',
  message: 'second',
  timeReceived: new Date(2026, 9, 3, 14, 3, 10).getTime(),
};
const third: GameMessage = {
  kind: 'chat',
  playerId: 3,
  senderName: 'Carol',
  message: 'third',
  timeReceived: new Date(2026, 9, 3, 14, 3, 11).getTime(),
};

describe('GameLogRows render stability', () => {
  afterEach(async () => {
    await testI18n.changeLanguage('en-US');
  });

  it('renders only a new row when a message is appended and keeps striping tied to row order', () => {
    const renderSender = vi.fn((name: string) => name);
    const props = {
      players: undefined,
      stampGameTime: false,
      renderSender,
    };
    const { rerender } = renderWithProviders(
      <GameLogRows {...props} messages={[first, second]} />,
    );

    expect(renderSender.mock.calls.map(([name]) => name)).toEqual(['Alice', 'Bob']);
    expect(screen.getByText('first').closest('div')).toHaveClass('bg-transparent');
    expect(screen.getByText('second').closest('div')).toHaveClass('bg-black/15');

    rerender(<GameLogRows {...props} messages={[first, second, third]} />);

    expect(renderSender.mock.calls.map(([name]) => name)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(screen.getByText('third').closest('div')).toHaveClass('bg-transparent');

    rerender(<GameLogRows {...props} messages={[second, first, third]} />);

    expect(renderSender).toHaveBeenCalledTimes(3);
    expect(screen.getByText('second').closest('div')).toHaveClass('bg-transparent');
    expect(screen.getByText('first').closest('div')).toHaveClass('bg-black/15');
  });

  it('keeps translated row contents subscribed to language changes', async () => {
    const message: GameMessage = {
      kind: 'event',
      playerId: 1,
      message: 'obsolete fallback',
      timeReceived: 0,
      descriptor: { kind: 'gameStarted', params: {} },
    };
    renderWithProviders(
      <GameLogRows messages={[message]} players={undefined} stampGameTime={false} />,
    );
    expect(screen.getByText('The game has started.')).toBeInTheDocument();

    testI18n.addResourceBundle('fr', 'translation', {
      GameLog: { gameStarted: { message: 'La partie commence.' } },
    }, true, true);
    await act(async () => {
      await testI18n.changeLanguage('fr');
    });

    expect(screen.getByText('La partie commence.')).toBeInTheDocument();
  });
});
