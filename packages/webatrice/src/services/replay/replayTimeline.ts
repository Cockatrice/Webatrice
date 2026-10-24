import { hasExtension } from '@bufbuild/protobuf';
import {
  Event_PlayerPropertiesChanged_ext,
  type GameEventContainer,
  type GameReplay,
} from '@cockatrice/sockatrice/generated';

export function createReplayTimeline(replay: GameReplay): number[] {
  const events = replay.eventList;
  const timeline: number[] = [];
  let lastEventTimestamp = 0;

  for (let i = 0; i < events.length; ++i) {
    let nextSecondIndex = i + 1;
    while (nextSecondIndex < events.length && events[nextSecondIndex].secondsElapsed === lastEventTimestamp) {
      ++nextSecondIndex;
    }

    const numberEventsThisSecond = nextSecondIndex - i;
    for (let k = 0; k < numberEventsThisSecond; ++k) {
      const eventMs = events[i + k].secondsElapsed * 1000;
      const distributionMs = Math.trunc((k / numberEventsThisSecond) * 1000);
      timeline.push(eventMs + distributionMs);
    }

    if (nextSecondIndex < events.length) {
      lastEventTimestamp = events[nextSecondIndex].secondsElapsed;
    }
    i += numberEventsThisSecond - 1;
  }

  return timeline;
}

export function hasMeaningfulEvent(container: GameEventContainer): boolean {
  return container.eventList.some((event) => !hasExtension(event, Event_PlayerPropertiesChanged_ext));
}

export const TIMELINE_BIN_MS = 5000;
export const MAX_TIMELINE_BINS = 2048;

export function createTimelineHistogram(timeline: readonly number[]): number[] {
  let maxTime = 0;
  for (const time of timeline) {
    if (!Number.isFinite(time) || time < 0) {
      throw new RangeError('Invalid replay timestamp.');
    }
    maxTime = Math.max(maxTime, time);
  }
  const binWidth = Math.max(TIMELINE_BIN_MS, Math.floor(maxTime / MAX_TIMELINE_BINS) + 1);
  const histogram = new Array<number>(Math.floor(maxTime / binWidth) + 1).fill(0);
  for (const time of timeline) {
    ++histogram[Math.floor(time / binWidth)];
  }
  return histogram;
}
