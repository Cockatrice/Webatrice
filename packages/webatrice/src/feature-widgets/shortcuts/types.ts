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
  preventDefault?: boolean;
}

export interface ParsedSequence {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type ActionId =
  | 'chat.focus'
  | 'game.untapAll'
  | 'game.drawCard'
  | 'game.drawMultipleCards'
  | 'game.undoDraw'
  | 'game.endTurn'
  | 'game.concede'
  | 'game.shuffleLibrary'
  | 'game.nextPhase'
  | 'game.prevPhase'
  | 'game.rollDice'
  | 'game.leaveGame'
  | 'game.viewSideboard'
  | 'game.mulliganSameSize'
  | 'game.mulliganMinusOne'
  | 'game.sortHandByType'
  | 'game.viewLibrary'
  | 'game.viewGraveyard'
  | 'game.playTop'
  | 'game.moveTopToGrave'
  | 'game.moveTopNToGrave'
  | 'game.closeRecentView'
  | 'game.flipCoin'
  | 'game.doesntUntap'
  | 'game.flipCard'
  | 'game.unattachCard'
  | 'game.cloneCard'
  | 'game.moveSelectedToGrave'
  | 'game.moveSelectedToLibraryBottom'
  | 'game.setCardPT'
  | 'game.incP'
  | 'game.decP'
  | 'game.incT'
  | 'game.decT'
  | 'game.incPT'
  | 'game.decPT'
  | 'game.setAnnotation'
  | 'game.selectAllBattlefield'
  | 'game.selectRowBattlefield'
  | 'game.selectColumnBattlefield'
  | 'game.incrementAllCardCounters'
  | 'game.addCounterA'
  | 'game.removeCounterA'
  | 'game.setCounterA'
  | 'game.addCounterB'
  | 'game.removeCounterB'
  | 'game.setCounterB'
  | 'game.addCounterC'
  | 'game.removeCounterC'
  | 'game.setCounterC'
  | 'game.peekCard'
  | 'game.attachCard'
  | 'game.addStormCounter'
  | 'game.removeStormCounter'
  | 'game.setStormCounter'
  | 'game.moveTopUntil'
  | 'game.alwaysRevealTopCard'
  | 'game.alwaysLookAtTopCard'
  | 'game.viewTopCards'
  | 'game.viewBottomCards'
  | 'game.createToken'
  | 'game.createAnotherToken'
  | 'game.drawArrow'
  | 'game.resetPT'
  | 'game.reduceLifeByPower'
  | 'deck.new'
  | 'deck.save'
  | 'deck.load'
  | 'deck.addCard'
  | 'deck.removeCard'
  | 'room.sendMessage';

export type ShortcutGroupId =
  | 'game'
  | 'gamePhases'
  | 'deckEditor'
  | 'room';

export interface ShortcutDef {
  scope: ShortcutScope;
  group: ShortcutGroupId;
  sequences: string[];
}
