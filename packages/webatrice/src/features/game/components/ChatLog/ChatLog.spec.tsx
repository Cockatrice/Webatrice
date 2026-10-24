import { act, screen, within } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';

import { renderWithProviders } from '../../../../__test-utils__';
import { getSettings, settingsStore } from '../../../../hooks/useSettings';
import { buildSeatGameState } from '../../__test-utils__/seatFixtures';
import { GameIdProvider } from '../ui/GameIdContext';
import ChatLog from './ChatLog';

const LOGGED_AT = new Date(2026, 9, 3, 14, 3, 9).getTime();
const MAX_GAME_MESSAGES = 1000;

function renderLog() {
  const preloadedState = buildSeatGameState({ localPlayerId: 1, seats: [{ playerId: 1, name: 'Alice' }] });
  preloadedState.games!.games![1]!.messages = [
    { playerId: 1, message: 'gg', timeReceived: LOGGED_AT, gameSeconds: 3725, kind: 'chat', senderName: 'Alice' },
  ];
  return renderWithProviders(
    <GameIdProvider value={1}>
      <ChatLog />
    </GameIdProvider>,
    { preloadedState },
  );
}

describe('ChatLog', () => {
  afterEach(() => {
    settingsStore.reset();
  });

  it('stamps each line with the local time, as desktop does by default', () => {
    renderLog();
    expect(screen.getByText(/gg/).closest('div')).toHaveTextContent('[14:03:09]');
  });

  it('stamps each line with the game time with "Use game time instead of local time" on', async () => {
    const settings = await getSettings();
    await act(async () => {
      settingsStore.setValue(Object.assign(settings, { useGameTime: true }));
    });
    renderLog();
    expect(screen.getByText(/gg/).closest('div')).toHaveTextContent('[01:02:05]');
  });

  describe('as a live region', () => {
    it('renders structured life events once and keeps their identity without classifying deprecated text', () => {
      const { store } = renderLog();
      const message = {
        kind: 'counterSet' as const,
        params: { actor: { id: 1, name: 'Alice' }, counterId: 0, counterName: 'life', value: 19, previousValue: 20 },
        text: 'It is now the obsolete English fallback.', segments: [],
      };
      act(() => {
        store.dispatch(games.Actions.gameMessageAppended({ gameId: 1, playerId: 1, message }));
      });
      const log = screen.getByRole('log', { name: 'ChatLog.heading' });
      const row = log.querySelector('[data-log-kind="counterSet"]');
      expect(row).toHaveTextContent('Alice sets counter Life to 19 (-1).');
      expect(row).toHaveAttribute('data-tone', 'action');
      expect(log.querySelectorAll('[data-log-kind="counterSet"]')).toHaveLength(1);
      expect(screen.queryByText(message.text)).not.toBeInTheDocument();
      act(() => {
        store.dispatch(games.Actions.gameInfoUpdated({ gameId: 1, activePhase: 3 }));
      });
      expect(log.querySelector('[data-log-kind="counterSet"]')).toBe(row);
      act(() => {
        store.dispatch(games.Actions.gameMessageAppended({ gameId: 1, playerId: 1, message }));
      });
      expect(log.querySelectorAll('[data-log-kind="counterSet"]')).toHaveLength(2);
      expect(log.querySelector('[data-log-kind="counterSet"]')).toBe(row);
      expect(log).toHaveAttribute('aria-live', 'polite');
      expect(log).toHaveAttribute('tabindex', '0');
    });

    it('is a polite log named by its heading, so new lines are read out as they arrive', () => {
      renderLog();
      const log = screen.getByRole('log', { name: 'ChatLog.heading' });
      expect(log).toHaveAttribute('aria-live', 'polite');
      expect(log).toHaveAttribute('aria-relevant', 'additions');
      expect(log).toHaveAttribute('tabindex', '0');
      expect(within(log).getByText(/gg/)).toBeInTheDocument();
    });

    it('names the say box once, by its label', () => {
      renderLog();
      const input = screen.getByRole('combobox', { name: 'ChatLog.inputLabel' });
      expect(input).not.toHaveAttribute('aria-label');
    });

    it('adds life changes once to the polite log and keeps their rows on unrelated updates', () => {
      const { store } = renderLog();
      const message = 'Alice sets counter Life to 19 (-1).';
      act(() => {
        store.dispatch(games.Actions.gameMessageAppended({ gameId: 1, playerId: 1, message }));
      });
      const log = screen.getByRole('log', { name: 'ChatLog.heading' });
      const line = within(log).getByText(message);
      expect(screen.getAllByText(message)).toHaveLength(1);
      expect(line.closest('[aria-live]')).toBe(log);
      expect(log).toHaveAttribute('aria-live', 'polite');
      expect(log).toHaveAttribute('tabindex', '0');
      act(() => {
        store.dispatch(games.Actions.gameInfoUpdated({ gameId: 1, activePhase: 3 }));
      });
      expect(within(log).getByText(message)).toBe(line);
      expect(screen.getAllByText(message)).toHaveLength(1);
    });

    it('preserves distinct equal-looking events without re-announcing the earlier row', () => {
      const { store } = renderLog();
      const message = 'Alice sets counter Life to 19 (-1).';
      act(() => {
        store.dispatch(games.Actions.gameMessageAppended({ gameId: 1, playerId: 1, message }));
      });
      const first = screen.getByText(message);
      act(() => {
        store.dispatch(games.Actions.gameMessageAppended({ gameId: 1, playerId: 1, message }));
      });
      expect(screen.getAllByText(message)).toHaveLength(2);
      expect(screen.getAllByText(message)[0]).toBe(first);
    });

    it('keeps the lines already shown when a new one arrives, so only the new one is read', () => {
      const { store } = renderLog();
      const first = screen.getByText(/gg/).closest('div');
      act(() => {
        store.dispatch(games.Actions.gameSay({ gameId: 1, playerId: 1, message: 'hello', timeReceived: LOGGED_AT }));
      });
      expect(screen.getByText(/gg/).closest('div')).toBe(first);
      expect(screen.getByText(/hello/)).toBeInTheDocument();
    });

    it('keeps the remaining lines when the full log drops its oldest one', () => {
      const preloadedState = buildSeatGameState({ localPlayerId: 1, seats: [{ playerId: 1, name: 'Alice' }] });
      preloadedState.games!.games![1]!.messages = Array.from({ length: MAX_GAME_MESSAGES }, (_, i) => ({
        playerId: 1, message: `line ${i}`, timeReceived: LOGGED_AT + i, kind: 'chat' as const, senderName: 'Alice',
      }));
      const { store } = renderWithProviders(
        <GameIdProvider value={1}>
          <ChatLog />
        </GameIdProvider>,
        { preloadedState },
      );
      const kept = screen.getByText('line 999').closest('div');
      act(() => {
        store.dispatch(games.Actions.gameSay({ gameId: 1, playerId: 1, message: 'newest', timeReceived: LOGGED_AT }));
      });
      expect(screen.queryByText('line 0')).not.toBeInTheDocument();
      expect(screen.getByText('line 999').closest('div')).toBe(kept);
    });
  });
});
