import { fireEvent, screen } from '@testing-library/react';
import { create } from '@bufbuild/protobuf';
import { games, type GameMessage, type PlayerEntry } from '@cockatrice/datatrice';
import { GameReplaySchema } from '@cockatrice/sockatrice/generated';

import { renderWithProviders } from '../../__test-utils__';
import type { OpenedReplay } from '@app/services';
import type { PreviewBoardModel } from './usePreviewBoardModel';
import type { GameLogRowsProps } from './GameLogRows';
import type { PreviewBoardProps } from './PreviewBoard';
import ReplayPreview from './ReplayPreview';

const harness = vi.hoisted(() => ({
  currentTime: 0,
  model: { seats: [], stack: [], activePlayerName: undefined, phase: undefined } as PreviewBoardModel,
  log: vi.fn((_props: GameLogRowsProps) => null),
  board: vi.fn((_props: PreviewBoardProps) => null),
}));
vi.mock('./GameLogRows', () => ({ GameLogRows: harness.log }));
vi.mock('./PreviewBoard', () => ({ default: harness.board }));
vi.mock('./usePreviewBoardModel', () => ({ usePreviewBoardModel: () => harness.model }));
vi.mock('./replayTurnMarks', async (importOriginal) => ({
  ...await importOriginal<typeof import('./replayTurnMarks')>(),
  createTurnMarks: () => [{ turn: 1, time: 1000 }],
}));
vi.mock('./useReplayPlayback', () => ({
  useReplayPlayback: () => ({
    state: { currentTime: harness.currentTime, maxTime: 10000, playing: true },
    timeline: [], seek: vi.fn(), skipBy: vi.fn(), togglePlay: vi.fn(),
  }),
}));

it.each<{ messages: GameMessage[] | undefined }>([
  { messages: undefined },
  { messages: [] },
  { messages: [{ kind: 'chat', playerId: 1, message: 'hello', timeReceived: 1 }] },
])(
  'skips log and board renders on clock-only updates with messages $messages', ({ messages: initialMessages }) => {
    harness.currentTime = 0;
    harness.model = { seats: [], stack: [], activePlayerName: undefined, phase: undefined };
    const messages = vi.spyOn(games.Selectors, 'getMessages').mockReturnValue(initialMessages);
    const players = vi.spyOn(games.Selectors, 'getPlayers').mockReturnValue(undefined);
    const opened = { gameId: -1, replay: create(GameReplaySchema), engine: { timeline: [] } } as unknown as OpenedReplay;
    const onWatchFrom = vi.fn();
    const view = () => <ReplayPreview opened={opened} onWatchFrom={onWatchFrom} />;
    const { rerender } = renderWithProviders(view());
    expect(harness.log).toHaveBeenCalledTimes(1);
    expect(harness.board).toHaveBeenCalledTimes(1);
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 200 });
    log.scrollTop = 10;
    harness.log.mockClear();
    harness.board.mockClear();

    harness.currentTime = 500;
    rerender(view());
    expect(harness.log).not.toHaveBeenCalled();
    expect(harness.board).not.toHaveBeenCalled();
    expect(log.scrollTop).toBe(10);

    harness.currentTime = 1500;
    rerender(view());
    expect(harness.log).not.toHaveBeenCalled();
    expect(harness.board).toHaveBeenCalledTimes(1);
    expect(harness.board.mock.calls[0][0]).toMatchObject({ turn: 1 });
    expect(screen.getByTestId('replay-preview-time')).toHaveTextContent('0:01 / 0:10');
    fireEvent.click(screen.getByRole('button', { name: 'ReplayPreview.watchFrom' }));
    expect(onWatchFrom).toHaveBeenCalledWith(1500);
    harness.board.mockClear();

    const nextMessages: GameMessage[] = [{ kind: 'chat', playerId: 1, message: 'new message', timeReceived: 2 }];
    messages.mockReturnValue(nextMessages);
    rerender(view());
    expect(harness.log).toHaveBeenCalledTimes(1);
    expect(harness.log.mock.calls[0][0]).toMatchObject({ messages: nextMessages });
    expect(log.scrollTop).toBe(200);
    expect(harness.board).not.toHaveBeenCalled();
    harness.log.mockClear();

    const nextPlayers: Record<number, PlayerEntry> = {};
    players.mockReturnValue(nextPlayers);
    harness.model = { ...harness.model, phase: 2 };
    rerender(view());
    expect(harness.log).toHaveBeenCalledTimes(1);
    expect(harness.log.mock.calls[0][0]).toMatchObject({ players: nextPlayers });
    expect(harness.board).toHaveBeenCalledTimes(1);
    expect(harness.board.mock.calls[0][0]).toMatchObject({ model: harness.model });
  },
);
