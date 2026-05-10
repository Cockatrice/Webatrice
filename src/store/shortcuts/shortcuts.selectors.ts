import { ShortcutsState } from './shortcuts.interfaces';

interface State {
  shortcuts: ShortcutsState;
}

/**
 * Slice selectors are pure state queries — they don't know about the shortcut catalog
 * (defaults, scopes). For resolved bindings or conflict detection, see
 * `useResolvedBinding` and the conflict computation in features/shortcuts/.
 */
export const Selectors = {
  getHydrated: ({ shortcuts }: State) => shortcuts.hydrated,
  getOverrides: ({ shortcuts }: State) => shortcuts.overrides,
  getRecordingActionId: ({ shortcuts }: State) => shortcuts.recordingActionId,
  getRecordingSequences: ({ shortcuts }: State) => shortcuts.recordingSequences,
  isOverridden: ({ shortcuts }: State, actionId: string): boolean =>
    actionId in shortcuts.overrides,
};
