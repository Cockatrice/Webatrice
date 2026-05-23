import { ShortcutsState } from './shortcuts.interfaces';

interface State {
  shortcuts: ShortcutsState;
}

export const Selectors = {
  getHydrated: ({ shortcuts }: State) => shortcuts.hydrated,
  getOverrides: ({ shortcuts }: State) => shortcuts.overrides,
  getRecordingActionId: ({ shortcuts }: State) => shortcuts.recordingActionId,
  getRecordingSequences: ({ shortcuts }: State) => shortcuts.recordingSequences,
  isOverridden: ({ shortcuts }: State, actionId: string): boolean =>
    actionId in shortcuts.overrides,
};
