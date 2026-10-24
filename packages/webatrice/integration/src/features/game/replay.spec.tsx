import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebClient } from '@cockatrice/sockatrice';
import { GameReplay } from '@app/features/game';
import { closeReplay, getOpenedReplays, getOpenedReplay, openReplay, parseReplay } from '@app/services';
import { RouteEnum } from '@app/types';

import { buildReplay, sayContainer } from '../../../../src/services/replay/__mocks__/fixtures';
import { renderFeatureScreen, store } from '../helpers';

const FIXTURE = resolve(__dirname, '../../../../src/services/replay/__mocks__/two-player-game.cor');

function gameOf(gameId: number) {
  return store.getState().games.games[gameId];
}

function renderReplay() {
  const replay = parseReplay(new Uint8Array(readFileSync(FIXTURE)));
  const replayKey = openReplay(replay, 'two-player-game.cor', WebClient.instance);
  const { gameId } = getOpenedReplay(replayKey)!;
  renderFeatureScreen(
    <Routes>
      <Route path={RouteEnum.REPLAY} element={<GameReplay />} />
    </Routes>,
    `/replay/${replayKey}`,
  );
  const timeline = screen.getByTestId('replay-timeline');
  vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 1000 } as DOMRect);
  const seekToFraction = (fraction: number) => fireEvent.click(timeline, { clientX: fraction * 1000 });
  return { replay, gameId, seekToFraction };
}

describe('replay playback of a recorded game', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    getOpenedReplays().forEach(({ key }) => closeReplay(key));
    vi.useRealTimers();
  });

  it('starts as an empty replay game and rebuilds the recorded game by replaying it', () => {
    const { replay, gameId, seekToFraction } = renderReplay();

    expect(gameOf(gameId)).toMatchObject({ replay: true, localPlayerId: -1, players: {} });
    expect(gameOf(gameId).info.gameId).toBe(replay.gameInfo!.gameId);

    act(() => seekToFraction(0.99));

    const game = gameOf(gameId);
    const joined = game.messages
      .map((m) => /^(e2e_\w+) has joined the game\.$/.exec(m.message)?.[1])
      .filter((name): name is string => name != null);
    expect(new Set(joined).size).toBe(2);
    expect(game.messages.some((m) => m.message === 'The game has started.')).toBe(true);
    expect(screen.queryByTestId('game-log-timer')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /players/i }));
    const rows = screen.getAllByTestId(/^player-list-item-/);
    for (const row of rows) {
      fireEvent.contextMenu(row);
      expect(document.querySelector('[data-player-context-menu]')).toBeNull();
    }
  });

  it('seeking back resets the game and replays only up to the target', () => {
    const { gameId, seekToFraction } = renderReplay();
    act(() => seekToFraction(0.99));
    const fullLog = gameOf(gameId).messages.length;

    act(() => seekToFraction(0));

    expect(gameOf(gameId).players).toEqual({});
    expect(gameOf(gameId).messages).toEqual([]);
    expect(fullLog).toBeGreaterThan(1);
  });

  it('plays through to the recorded close and keeps the board', () => {
    const { replay, gameId } = renderReplay();
    const durationMs = (replay.eventList.at(-1)!.secondsElapsed + 2) * 1000;

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.fastForward' }));
      fireEvent.click(screen.getByRole('button', { name: 'GameReplay.controls.play' }));
    });
    act(() => {
      vi.advanceTimersByTime(durationMs / 10 + 1000);
    });

    expect(gameOf(gameId).messages.at(-1)?.message).toBe('The game has been closed.');
    expect(screen.getByRole('button', { name: 'GameReplay.controls.play' })).toBeInTheDocument();
    expect(screen.getByTestId('replay-time')).toHaveTextContent(/^(\d+:\d\d) \/ \1$/);
  });

  it('logs each line at the game time of its recorded container, however fast it plays', () => {
    const replay = buildReplay([sayContainer(0, 'hello'), sayContainer(65, 'attack'), sayContainer(3725, 'gg')]);
    const { gameId } = getOpenedReplay(openReplay(replay, 'timed.cor', WebClient.instance))!;
    for (const container of replay.eventList) {
      WebClient.instance.replayGameEventContainer(container, gameId);
    }

    const said = gameOf(gameId).messages.filter((m) => m.kind === 'chat');
    expect(said.map((m) => [m.message, m.gameSeconds])).toEqual([
      ['hello', 0],
      ['attack', 65],
      ['gg', 3725],
    ]);
  });
});
