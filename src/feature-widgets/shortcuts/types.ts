// Feature-internal narrow type: the closed catalog of action ids the shortcut feature
// knows about. Re-exported via the feature barrel for consumers (containers, the slice
// imports the looser `string` shape from @app/types instead).
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
  scope: import('@app/types').App.ShortcutScope;
  group: ShortcutGroupId;
  sequences: string[];
}
