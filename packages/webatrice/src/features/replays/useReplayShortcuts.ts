import { ShortcutScope, useShortcutGroup } from '@app/feature-widgets/shortcuts';
import { REPLAY_SHORTCUT_IDS, runReplayShortcut, type ReplayShortcutBinder } from '@app/feature-widgets/replay-player';

export const useReplayShortcuts: ReplayShortcutBinder = (actions, enabled) => {
  useShortcutGroup(REPLAY_SHORTCUT_IDS, (actionId) => runReplayShortcut(actions, actionId), { scope: ShortcutScope.REPLAYS, enabled });
};
