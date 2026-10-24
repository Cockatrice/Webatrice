import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { usePreference, useSettings } from '@app/hooks';
import { DEFAULT_FAST_FORWARD_SPEED, type OpenedReplay, type ReplayPlaybackState } from '@app/services';

import { noReplayShortcuts, type ReplayShortcutBinder } from './replayShortcuts';

export interface ReplayPlayback {
  state: ReplayPlaybackState;
  timeline: readonly number[];
  fastForward: boolean;
  fastForwardSpeed: number;
  togglePlay: () => void;
  toggleFastForward: () => void;
  seek: (time: number) => void;
  skipBy: (amount: number) => void;
  setFastForwardSpeed: (speed: number) => void;
  setSkipEmptySections: (value: boolean) => void;
}

const IDLE_STATE: ReplayPlaybackState = {
  currentTime: 0,
  maxTime: 0,
  processedEvents: 0,
  totalEvents: 0,
  playing: false,
  finished: false,
  timeScaleFactor: 1,
  skipEmptySections: false,
};
const NO_TIMELINE: readonly number[] = [];
const subscribeNothing = () => () => {};
const getIdleState = () => IDLE_STATE;

export function useReplayPlayback(
  opened: OpenedReplay | undefined,
  useShortcuts: ReplayShortcutBinder = noReplayShortcuts,
): ReplayPlayback {
  const settings = useSettings();
  const engine = opened?.engine ?? null;
  const [fastForward, setFastForward] = useState(() => (engine?.getState().timeScaleFactor ?? 1) !== 1);

  const state = useSyncExternalStore(engine?.subscribe ?? subscribeNothing, engine?.getState ?? getIdleState);

  const fastForwardSpeed = usePreference('replayFastForwardSpeed') ?? DEFAULT_FAST_FORWARD_SPEED;
  const skipEmptySetting = usePreference('replaySkipEmptySections') ?? false;
  const rewindBufferingMs = usePreference('replayRewindBufferingMs');

  useEffect(() => {
    engine?.setTimeScaleFactor(fastForward ? fastForwardSpeed : 1);
  }, [engine, fastForward, fastForwardSpeed]);

  useEffect(() => {
    engine?.setSkipEmptySections(skipEmptySetting);
  }, [engine, skipEmptySetting]);

  useEffect(() => {
    engine?.setRewindBufferingMs(rewindBufferingMs);
  }, [engine, rewindBufferingMs]);

  const togglePlay = useCallback(() => engine?.togglePlay(), [engine]);
  const toggleFastForward = useCallback(() => setFastForward((on) => !on), []);
  const seek = useCallback((time: number) => engine?.seek(time), [engine]);
  const skipBy = useCallback((amount: number) => engine?.skipBy(amount), [engine]);

  const { update } = settings;
  const setFastForwardSpeed = useCallback(
    (speed: number) => void update({ replayFastForwardSpeed: speed }),
    [update],
  );
  const setSkipEmptySections = useCallback(
    (value: boolean) => void update({ replaySkipEmptySections: value }),
    [update],
  );

  useShortcuts({ togglePlay, toggleFastForward, skipBy }, engine != null);

  return {
    state,
    timeline: engine?.timeline ?? NO_TIMELINE,
    fastForward,
    fastForwardSpeed,
    togglePlay,
    toggleFastForward,
    seek,
    skipBy,
    setFastForwardSpeed,
    setSkipEmptySections,
  };
}
