export interface ShortcutsState {
  overrides: Record<string, string[]>;
  hydrated: boolean;
  recordingActionId: string | null;
  recordingSequences: string[];
}
