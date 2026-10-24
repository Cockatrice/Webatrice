import { create, setExtension } from '@bufbuild/protobuf';
import {
  Event_SetActivePlayer_ext,
  Event_SetActivePlayerSchema,
  GameEventContainerSchema,
  GameEventSchema,
  type GameEventContainer,
} from '@cockatrice/sockatrice/generated';

import { createReplayTimeline } from '@app/services';

import { buildReplay, sayContainer } from '../../services/replay/__mocks__/fixtures';
import { createTurnMarks, turnAt } from './replayTurnMarks';

function activePlayerContainer(secondsElapsed: number, activePlayerId = 0): GameEventContainer {
  const event = create(GameEventSchema, { playerId: -1 });
  setExtension(event, Event_SetActivePlayer_ext, create(Event_SetActivePlayerSchema, { activePlayerId }));
  return create(GameEventContainerSchema, { secondsElapsed, eventList: [event] });
}

describe('createTurnMarks', () => {
  it('marks each active-player change at its timeline position, numbered from one', () => {
    const replay = buildReplay([
      sayContainer(0),
      activePlayerContainer(5, 0),
      sayContainer(9),
      activePlayerContainer(12, 1),
      activePlayerContainer(40, 0),
    ]);
    const timeline = createReplayTimeline(replay);

    expect(createTurnMarks(replay, timeline)).toEqual([
      { turn: 1, time: 5000 },
      { turn: 2, time: 12000 },
      { turn: 3, time: 40000 },
    ]);
  });

  it('has no marks for a recording without turn changes', () => {
    const replay = buildReplay([sayContainer(0), sayContainer(3)]);
    expect(createTurnMarks(replay, createReplayTimeline(replay))).toEqual([]);
  });
});

describe('turnAt', () => {
  const marks = [{ turn: 1, time: 5000 }, { turn: 2, time: 12000 }];

  it('is zero before the first turn and the latest mark at or before the time afterwards', () => {
    expect(turnAt(marks, 0)).toBe(0);
    expect(turnAt(marks, 5000)).toBe(1);
    expect(turnAt(marks, 11999)).toBe(1);
    expect(turnAt(marks, 60000)).toBe(2);
  });
});
