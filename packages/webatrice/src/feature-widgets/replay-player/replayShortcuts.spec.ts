import { BIG_SKIP_MS, SMALL_SKIP_MS } from '@app/services';

import { REPLAY_SHORTCUT_IDS, runReplayShortcut } from './replayShortcuts';

it('maps every replay shortcut id to its playback action', () => {
  const actions = { togglePlay: vi.fn(), toggleFastForward: vi.fn(), skipBy: vi.fn() };
  REPLAY_SHORTCUT_IDS.forEach((id) => runReplayShortcut(actions, id));
  runReplayShortcut(actions, 'replays.unknown');

  expect(REPLAY_SHORTCUT_IDS).toHaveLength(6);
  expect(actions.togglePlay).toHaveBeenCalledTimes(1);
  expect(actions.toggleFastForward).toHaveBeenCalledTimes(1);
  expect(actions.skipBy.mock.calls.map(([amount]) => amount)).toEqual([SMALL_SKIP_MS, -SMALL_SKIP_MS, BIG_SKIP_MS, -BIG_SKIP_MS]);
});
