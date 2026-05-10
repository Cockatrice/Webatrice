// Layered scope categories used to gate shortcut handlers. The actual route→scope
// mapping lives in the ShortcutProvider (a feature concern); this enum is shared so
// hooks and consumer code (dialogs, components) can name a scope without pulling from
// the feature module.
export enum ShortcutScope {
  GLOBAL = 'GLOBAL',
  GAME = 'GAME',
  DECK_EDITOR = 'DECK_EDITOR',
  ROOM = 'ROOM',
  REPLAYS = 'REPLAYS',
}

export type ShortcutHandler = (event: KeyboardEvent) => void;

export interface ShortcutRegistration {
  actionId: string;
  handler: ShortcutHandler;
  scope: ShortcutScope;
  /** Call event.preventDefault() before invoking the handler. Default true. */
  preventDefault?: boolean;
}

export interface ParsedSequence {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}
