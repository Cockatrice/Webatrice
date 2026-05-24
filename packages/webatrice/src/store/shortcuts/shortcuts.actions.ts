import { shortcutsSlice } from './shortcuts.reducer';

export const Actions = { ...shortcutsSlice.actions };

export type ShortcutsAction = ReturnType<typeof Actions[keyof typeof Actions]>;
