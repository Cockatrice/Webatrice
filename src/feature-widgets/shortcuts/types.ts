import type { ShortcutScope } from '@app/types';

export type ActionId =
  | 'app.openSettings'
  | 'app.toggleFullscreen'
  | 'chat.focus'
  | 'game.untapAll'
  | 'game.drawCard'
  | 'game.endTurn'
  | 'game.concede'
  | 'game.shuffleLibrary'
  | 'game.nextPhase'
  | 'game.prevPhase'
  | 'deck.new'
  | 'deck.save'
  | 'deck.load'
  | 'deck.addCard'
  | 'deck.removeCard'
  | 'room.sendMessage';

export type ShortcutGroupId =
  | 'global'
  | 'game'
  | 'gamePhases'
  | 'deckEditor'
  | 'room';

export interface ShortcutDef {
  scope: ShortcutScope;
  group: ShortcutGroupId;
  sequences: string[];
}
