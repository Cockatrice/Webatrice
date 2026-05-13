import { ShortcutScope } from '@app/types';
import { ActionId, ShortcutDef } from './types';

export const defaults: Record<ActionId, ShortcutDef> = {
  'app.openSettings': { scope: ShortcutScope.GLOBAL, group: 'global', sequences: ['Ctrl+Comma'] },
  'app.toggleFullscreen': { scope: ShortcutScope.GLOBAL, group: 'global', sequences: ['F11'] },
  'chat.focus': { scope: ShortcutScope.GLOBAL, group: 'global', sequences: ['Ctrl+Slash'] },

  'game.untapAll': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['F5'] },
  'game.drawCard': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Ctrl+KeyD'] },
  'game.endTurn': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['F10'] },
  'game.concede': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Ctrl+Backspace'] },
  'game.shuffleLibrary': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Ctrl+KeyS'] },
  'game.nextPhase': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['Tab'] },
  'game.prevPhase': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['Shift+Tab'] },

  'deck.new': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyN'] },
  'deck.save': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyS'] },
  'deck.load': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyO'] },
  'deck.addCard': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Equal', 'NumpadAdd'] },
  'deck.removeCard': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Minus', 'NumpadSubtract'] },

  'room.sendMessage': { scope: ShortcutScope.ROOM, group: 'room', sequences: ['Enter'] },
};

// Actions that fire even when focus is in a text input. Most shortcuts skip text-input
// targets so typing `=` in a search box doesn't fire deck.addCard.
export const firesInTextInputs: ReadonlySet<ActionId> = new Set<ActionId>([
  'room.sendMessage',
]);

export const allActionIds = Object.keys(defaults) as ActionId[];

// Catalog lookup that takes the loose `string` type the runtime sees (registrations
// from useShortcut, override keys from Dexie). Hides the cast in one place so the
// Provider and resolver don't need to spell it out.
export function getDefaultFor(actionId: string): ShortcutDef | undefined {
  return defaults[actionId as ActionId];
}

export function firesInTextInputsFor(actionId: string): boolean {
  return firesInTextInputs.has(actionId as ActionId);
}
