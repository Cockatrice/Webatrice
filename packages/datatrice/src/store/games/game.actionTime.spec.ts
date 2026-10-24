import { create } from '@bufbuild/protobuf';
import {
  Event_ChangeZonePropertiesSchema,
  Event_DumpZoneSchema,
  Event_GameLogNotice_NoticeType,
  Event_RollDieSchema,
  Event_ShuffleSchema,
  ServerInfo_GameSchema,
} from '@cockatrice/sockatrice/generated';
import { makeGameEntry, makePlayerEntry, makeState, makeZoneEntry } from '../../testing/fixtures/games';
import { Actions } from './game.actions';
import { gamesReducer } from './game.reducer';
import { formatCardsDrawn } from './messageLog';

const actionFactories = [
  ['append', () => Actions.gameMessageAppended({ gameId: 1, playerId: 1, message: 'event' })],
  ['shuffle', () => Actions.zoneShuffled({ gameId: 1, playerId: 1, data: create(Event_ShuffleSchema, { zoneName: 'deck' }) })],
  ['dump', () => Actions.zoneDumped({ gameId: 1, playerId: 1, data: create(Event_DumpZoneSchema, { zoneName: 'deck' }) })],
  ['die', () => Actions.dieRolled({ gameId: 1, playerId: 1, data: create(Event_RollDieSchema, { sides: 6 }) })],
  ['notice', () => Actions.gameLogNotice({ gameId: 1, playerId: 1, noticeType: Event_GameLogNotice_NoticeType.UNDO_DRAW_FAILED })],
  ['zone properties', () => Actions.zonePropertiesChanged({
    gameId: 1, playerId: 1, data: create(Event_ChangeZonePropertiesSchema, { zoneName: 'deck', alwaysRevealTopCard: true }),
  })],
  ['replay closed', () => Actions.gameClosed({ gameId: 1 })],
  ['replay loaded', () => Actions.replayGameLoaded({ gameId: 2, gameInfo: create(ServerInfo_GameSchema, { gameId: 2 }) })],
  ['game clock', () => Actions.gameInfoUpdated({ gameId: 1, secondsElapsed: 30 })],
  ['replay clock', () => Actions.gameTimeSynced({ gameId: 1, secondsElapsed: 45 })],
] as const;

describe('game action timestamps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(actionFactories)('%s captures time once and reduces deterministically later', (_name, makeAction) => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(5000);
    const action = makeAction();
    expect(action.payload.timeReceived).toBe(5000);
    expect(clock).toHaveBeenCalledTimes(1);
    const game = makeGameEntry({
      replay: true, secondsElapsed: 10, secondsElapsedAt: 2000,
      players: { 1: makePlayerEntry({ zones: { deck: makeZoneEntry({ name: 'deck' }) } }) },
    });
    const state = makeState({ games: { 1: game } });
    clock.mockImplementation(() => {
      throw new Error('A reducer read the clock');
    });
    const first = gamesReducer(state, action);
    expect(gamesReducer(state, action)).toEqual(first);
    expect(clock).toHaveBeenCalledTimes(1);
    for (const result of Object.values(first.games)) {
      for (const message of result.messages) {
        expect(message.timeReceived).toBe(5000);
      }
    }
  });

  it('accepts an explicit zero timestamp and freezes the game-time stamp into the action result', () => {
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Unexpected clock read');
    });
    const game = makeGameEntry({ secondsElapsed: 12, secondsElapsedAt: -3000 });
    const message = formatCardsDrawn(game, 1, 2);
    const action = Actions.gameMessageAppended({ gameId: 1, playerId: 1, message, timeReceived: 0 });
    const result = gamesReducer(makeState({ games: { 1: game } }), action);
    expect(result.games[1].messages[0]).toMatchObject({
      timeReceived: 0, gameSeconds: 15, kind: 'event',
      descriptor: { kind: 'cardsDrawn', params: { count: 2 } },
      message: message.text, segments: message.segments,
    });
    expect(clock).not.toHaveBeenCalled();
  });

  it('uses the captured time to synchronize a live clock, regardless of reduction time', () => {
    const state = makeState({ games: { 1: makeGameEntry() } });
    const action = Actions.gameInfoUpdated({ gameId: 1, secondsElapsed: 30, timeReceived: 5000 });
    vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Unexpected clock read');
    });
    const result = gamesReducer(state, action);
    expect(result.games[1]).toMatchObject({ secondsElapsed: 30, secondsElapsedAt: 5000 });
  });
});
