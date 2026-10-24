import { BIG_SKIP_MS, SMALL_SKIP_MS } from '@app/services';

export interface ReplayShortcutActions {
  togglePlay: () => void;
  toggleFastForward: () => void;
  skipBy: (amount: number) => void;
}

export type ReplayShortcutBinder = (actions: ReplayShortcutActions, enabled: boolean) => void;

const HANDLERS: Record<string, (actions: ReplayShortcutActions) => void> = {
  'replays.playPause': (actions) => actions.togglePlay(),
  'replays.toggleFastForward': (actions) => actions.toggleFastForward(),
  'replays.skipForward': (actions) => actions.skipBy(SMALL_SKIP_MS),
  'replays.skipBackward': (actions) => actions.skipBy(-SMALL_SKIP_MS),
  'replays.skipForwardBig': (actions) => actions.skipBy(BIG_SKIP_MS),
  'replays.skipBackwardBig': (actions) => actions.skipBy(-BIG_SKIP_MS),
};

export const REPLAY_SHORTCUT_IDS: readonly string[] = Object.keys(HANDLERS);

export function runReplayShortcut(actions: ReplayShortcutActions, actionId: string): void {
  HANDLERS[actionId]?.(actions);
}

export const noReplayShortcuts: ReplayShortcutBinder = () => {};
