import { PlaymatFallbackBehavior, PlaymatMode } from '@app/hooks';
import { endSession } from '@app/services/session';
import { getPlaymatSyncState, prunePlaymatSyncState } from './playmatSyncState';

describe('playmatSyncState', () => {
  afterEach(() => {
    prunePlaymatSyncState([]);
  });

  it('keeps one state per game', () => {
    const state = getPlaymatSyncState(1);
    state.rotation = 3;
    expect(getPlaymatSyncState(1)).toBe(state);
    expect(getPlaymatSyncState(2).rotation).toBe(0);
  });

  it('forgets all playmat state when game ids are reused across sessions', () => {
    const initial = { ...getPlaymatSyncState(1) };
    for (const deckHash of ['first-session', 'second-session']) {
      const state = getPlaymatSyncState(1);
      const playmat = { cardName: 'Old deck', cardProviderId: '',
        params: { marginPctL: 0.07, marginPctR: 0.07, verticalOffset: 0.33, zoom: 1 } };
      Object.assign(state, {
        deckHash, deckPlaymat: playmat, lastSent: playmat, lastResolved: playmat,
        rotation: 3, wasStarted: true, wasReady: true,
        settings: { mode: PlaymatMode.OVERRIDE_DECK,
          fallbackBehavior: PlaymatFallbackBehavior.ROUND_ROBIN, fallbackList: [playmat] },
      });
      getPlaymatSyncState(2).rotation = 5;

      endSession();

      expect(getPlaymatSyncState(1)).not.toBe(state);
      expect(getPlaymatSyncState(1)).toEqual(initial);
      expect(getPlaymatSyncState(2)).toEqual(initial);
    }
  });

  it('forgets games that are no longer joined', () => {
    getPlaymatSyncState(1).rotation = 3;
    getPlaymatSyncState(2).rotation = 5;
    prunePlaymatSyncState([2]);
    expect(getPlaymatSyncState(1).rotation).toBe(0);
    expect(getPlaymatSyncState(2).rotation).toBe(5);
  });
});
