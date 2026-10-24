import { hasExtension } from '@bufbuild/protobuf';
import { Event_SetActivePlayer_ext, type GameReplay } from '@cockatrice/sockatrice/generated';

export interface TurnMark {
  turn: number;
  time: number;
}

export function createTurnMarks(replay: GameReplay, timeline: readonly number[]): TurnMark[] {
  const marks: TurnMark[] = [];
  replay.eventList.forEach((container, index) => {
    const time = timeline[index];
    if (time === undefined || !container.eventList.some((event) => hasExtension(event, Event_SetActivePlayer_ext))) {
      return;
    }
    marks.push({ turn: marks.length + 1, time });
  });
  return marks;
}

export function turnAt(marks: readonly TurnMark[], time: number): number {
  let turn = 0;
  for (const mark of marks) {
    if (mark.time > time) {
      break;
    }
    turn = mark.turn;
  }
  return turn;
}
