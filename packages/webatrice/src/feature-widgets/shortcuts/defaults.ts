import { ActionId, ShortcutDef, ShortcutScope } from './types';

export const defaults: Record<ActionId, ShortcutDef> = {
  // Bindings align with Cockatrice desktop defaults from
  // vendor/cockatrice/cockatrice/src/client/settings/shortcuts_settings.h.
  // See plans/shortcuts.md for the browser-compatibility audit and
  // per-action progress tracking. The game sections below follow desktop's
  // shortcut groups; a browser-reserved desktop key is remapped where it
  // is defined, with the reason.

  // Card Counters (desktop ShortcutGroup::Card_Counters).
  // Card-counter shortcuts. Cockatrice ships three default counter
  // colors (A red / B yellow / C green) with Add / Remove / Set-value
  // bindings each. counterId matches Card.tsx's COUNTER_COLORS index
  // (0=A red, 1=B yellow, 2=C green). Sequences mirror desktop's
  //   aCCGreen (Add C)   = Ctrl+>   → Ctrl+Shift+Period
  //   aRCGreen (Rem C)   = Ctrl+<   → Ctrl+Shift+Comma
  //   aSCGreen (Set C…)  = Ctrl+?   → Ctrl+Shift+Slash
  //   aCCYellow (Add B)  = Ctrl+.   → Ctrl+Period
  //   aRCYellow (Rem B)  = Ctrl+,   → Ctrl+Comma
  //   aSCYellow (Set B…) = Ctrl+/   → Ctrl+Slash
  //   aCCRed (Add A)     = Alt+.    → Alt+Period
  //   aRCRed (Rem A)     = Alt+,    → Alt+Comma
  //   aSCRed (Set A…)    = Alt+/    → Alt+Slash
  'game.addCounterA': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Alt+Period'] },
  'game.removeCounterA': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Alt+Comma'] },
  'game.setCounterA': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Alt+Slash'] },
  'game.addCounterB': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Period'] },
  'game.removeCounterB': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Comma'] },
  'game.setCounterB': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Slash'] },
  'game.addCounterC': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Shift+Period'] },
  'game.removeCounterC': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Shift+Comma'] },
  'game.setCounterC': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: ['Ctrl+Shift+Slash'] },
  'game.addCounterD': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.removeCounterD': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.setCounterD': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.addCounterE': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.removeCounterE': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.setCounterE': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.addCounterF': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.removeCounterF': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },
  'game.setCounterF': { scope: ShortcutScope.GAME, group: 'gameCardCounters', sequences: [] },

  'game.incLife': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Shift+F12'] },
  'game.decLife': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Shift+F11'] },
  'game.setLife': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Ctrl+KeyL'] },
  'game.incManaCounterW': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterW': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterW': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.incManaCounterU': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterU': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterU': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.incManaCounterB': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterB': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterB': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.incManaCounterR': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterR': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterR': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.incManaCounterG': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterG': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterG': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.incManaCounterX': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.decManaCounterX': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  'game.setManaCounterX': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: [] },
  // Cockatrice's `aIncCounter_storm` / `aDecCounter_storm` /
  // `aSetCounter_storm` (Ctrl+] / Ctrl+[ / Ctrl+\) — Add / Remove /
  // Set the local player's "Other" (storm) counter. Uses
  // onModifyCounter / setSetManaCounterModal (player-scoped, distinct
  // from the per-card counter shortcuts above). Storm is Servatrice's
  // seventh pre-created player counter (server_player.cpp:102).
  'game.addStormCounter': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Ctrl+BracketRight'] },
  'game.removeStormCounter': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Ctrl+BracketLeft'] },
  'game.setStormCounter': { scope: ShortcutScope.GAME, group: 'gamePlayerCounters', sequences: ['Ctrl+Backslash'] },

  // Power and Toughness (desktop ShortcutGroup::Power_Toughness).
  // Cockatrice P/T deltas. Each ships with both the "type-a-symbol"
  // and the "same-key-without-shift" binding (parity with desktop's
  // `Ctrl++;Ctrl+=` dual-sequence idiom for keyboards where `+`
  // needs Shift). NumpadAdd/Subtract for numpad users.
  //   aIncP:  Ctrl++       → +1/+0
  //   aDecP:  Ctrl+-       → -1/-0
  //   aIncT:  Alt++        → +0/+1
  //   aDecT:  Alt+-        → -0/-1
  //   aIncPT: Ctrl+Alt++   → +1/+1
  //   aDecPT: Ctrl+Alt+-   → -1/-1
  // Note: Ctrl+= / Ctrl+- also drive browser zoom. Modern Chromium
  // lets keydown preventDefault them; if a user reports zoom firing
  // alongside, rebinding in the shortcuts settings is the workaround.
  'game.incP': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Ctrl+Equal', 'Ctrl+Shift+Equal', 'Ctrl+NumpadAdd'] },
  'game.decP': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Ctrl+Minus', 'Ctrl+NumpadSubtract'] },
  'game.flowP': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: [] },
  'game.incT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Alt+Equal', 'Alt+Shift+Equal', 'Alt+NumpadAdd'] },
  'game.decT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Alt+Minus', 'Alt+NumpadSubtract'] },
  'game.flowT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: [] },
  'game.incPT': {
    scope: ShortcutScope.GAME,
    group: 'gamePowerToughness',
    sequences: ['Ctrl+Alt+Equal', 'Ctrl+Alt+Shift+Equal', 'Ctrl+Alt+NumpadAdd'],
  },
  'game.decPT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Ctrl+Alt+Minus', 'Ctrl+Alt+NumpadSubtract'] },
  // Cockatrice's `aSetPT` (Ctrl+P) — opens the "Set Power/Toughness"
  // modal against the selection. First-selected card drives the
  // modal's label / prefill (same as the menu path but without a
  // right-clicked card).
  'game.setCardPT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Ctrl+KeyP'] },
  // Cockatrice's `aResetPT` (Ctrl+Alt+0) — resets selection PT to base.
  'game.resetPT': { scope: ShortcutScope.GAME, group: 'gamePowerToughness', sequences: ['Ctrl+Alt+Digit0'] },

  'game.setPhase0': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase1': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase2': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase3': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase4': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase5': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase6': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase7': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase8': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase9': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.setPhase10': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  // Cockatrice's `aNextTurn` accepts either Ctrl+Return or Ctrl+Enter
  // (numpad); browser event.code names them Enter and NumpadEnter.
  'game.endTurn': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['Ctrl+Enter', 'Ctrl+NumpadEnter'] },
  // Cockatrice's `aNextPhase` accepts Ctrl+Space OR Tab; keep both.
  'game.nextPhase': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['Tab', 'Ctrl+Space'] },
  'game.prevPhase': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },
  'game.nextPhaseAction': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: ['Shift+Tab'] },
  'game.reverseTurn': { scope: ShortcutScope.GAME, group: 'gamePhases', sequences: [] },

  // Playing Area (desktop ShortcutGroup::Playing_Area).
  // Cockatrice's `aIncrementAllCardCounters` (Ctrl+Shift+A) — for
  // each targeted card (selection if any, else full battlefield),
  // bumps every EXISTING counter by +1 (skips MAX_COUNTER_VALUE).
  // Same logic as the utility-menu "Increment all card counters" item.
  'game.incrementAllCardCounters': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Shift+KeyA'] },
  'game.hideRevealedCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Alt+KeyH'] },
  'game.tapCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: [] },
  // `game.untapAll` uses Ctrl+U (Cockatrice default) instead of F5
  // because F5 is a browser-reserved reload key that
  // `event.preventDefault()` cannot cancel in Chromium.
  'game.untapAll': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+KeyU'] },
  // Cockatrice's `aDoesntUntap` (Alt+U) — toggles the "Skip Untapping"
  // flag on the current selection's battlefield cards. Uses the same
  // bulkDoesntUntap wire the card-menu "Doesn't Untap / Allow Untap"
  // item already fires; selection ∩ TABLE, then judge-wrapped per owner.
  'game.doesntUntap': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Alt+KeyU'] },
  // Cockatrice's `aFlip` (Alt+F) — toggles face-down on the selection's
  // battlefield cards. Uses the first selected card's current faceDown
  // to drive the target so a mixed selection unifies (same rule the
  // right-click "Flip card" menu uses).
  'game.flipCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Alt+KeyF'] },
  // Cockatrice's `aPeek` (Alt+L) — reveals face-down battlefield cards
  // in the selection to the local player only. No-op if the selection
  // has no face-down cards (matches the menu path which only shows
  // the "Peek card" item when the right-clicked card is face-down).
  'game.peekCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Alt+KeyL'] },
  'game.playCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: [] },
  'game.playCardFaceDown': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: [] },
  // Cockatrice's `aAttach` (Ctrl+Alt+A) — starts the "attach arrow"
  // pending flow. Attach is 1:1 (source → target) so the first
  // selected card is used as source; the next battlefield click
  // resolves the attach. Escape or clicking the source cancels.
  'game.attachCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Alt+KeyA'] },
  // Cockatrice's `aUnattach` (Ctrl+Alt+U) — fires per-card unattach on
  // the selection. Server no-ops for non-attached cards, so we don't
  // filter client-side.
  'game.unattachCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Alt+KeyU'] },
  // Cockatrice's `aClone` (Ctrl+J) — fires one Command_CreateToken per
  // selected card, preserving each card's own metadata. Server has no
  // batch wire so we loop; optimistic-mock cards (non-numeric id) are
  // skipped, matching the menu path.
  'game.cloneCard': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+KeyJ'] },
  // Create token modal + re-fire. Cockatrice uses Ctrl+T (new tab,
  // hardcoded); rebound to Ctrl+K per the plan.
  'game.createToken': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+KeyK'] },
  'game.createAnotherToken': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+KeyG'] },
  'game.createRelatedTokens': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Shift+KeyK'] },
  // Cockatrice's `aSetAnnotation` (Alt+N) — opens the annotation
  // modal against the selection. First-selected card drives the
  // label / prefill, same shape as Set Power/Toughness.
  'game.setAnnotation': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Alt+KeyN'] },
  // Cockatrice's `aReduceLifeByPower` (Ctrl+Shift+L) — sums selection
  // powers and subtracts from local player's life.
  'game.reduceLifeByPower': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Shift+KeyL'] },
  // Cockatrice's `aSelectAll` (Ctrl+A) — selects every card on the
  // local player's battlefield. Cockatrice desktop uses "zone under
  // cursor" semantics; this first pass just always targets own
  // battlefield, since that's the actionable zone for the bulk-action
  // shortcuts (doesntUntap, flip, clone, move-to-grave, PT deltas)
  // that consume the selection.
  'game.selectAllBattlefield': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+KeyA'] },
  // Cockatrice's `aSelectRow` / `aSelectColumn` (Ctrl+Shift+X / +C) —
  // expand the selection to every battlefield card sharing the
  // first-selected card's row / column. First-pass anchor rule: use
  // the first card in the current selection (menu path uses the
  // right-clicked card). No-op with an empty selection.
  'game.selectRowBattlefield': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Shift+KeyX'] },
  'game.selectColumnBattlefield': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: ['Ctrl+Shift+KeyC'] },
  'game.revealSelectedToAll': { scope: ShortcutScope.GAME, group: 'gamePlayingArea', sequences: [] },

  // Move Selected Card (desktop ShortcutGroup::Move_selected). Each acts on the
  // battlefield selection or the hand selection.
  // Cockatrice's `aMoveToBottomLibrary` (Ctrl+B) — moves the selection
  // to the bottom of the local player's library. Uses `x: 0` with
  // `isReversed: true`, matching the menu's "Bottom of library" path
  // (the card menu's Move to > Bottom of library).
  'game.moveSelectedToLibraryBottom': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: ['Ctrl+KeyB'] },
  'game.moveSelectedToExile': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: [] },
  // Cockatrice's `aMoveToGraveyard` (Ctrl+Del) — moves the selection
  // to the local player's graveyard. Single batched Command_MoveCard
  // with cards_to_move populated, matching the menu's "Send to
  // Graveyard" path.
  'game.moveSelectedToGrave': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: ['Ctrl+Delete'] },
  'game.moveSelectedToHand': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: [] },
  'game.moveSelectedToLibraryTop': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: [] },
  'game.moveSelectedToBattlefield': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: [] },
  'game.moveCardDialog': { scope: ShortcutScope.GAME, group: 'gameMoveSelected', sequences: ['KeyM'] },

  'game.viewHand': { scope: ShortcutScope.GAME, group: 'gameView', sequences: [] },
  'game.viewGraveyard': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['F4'] },
  'game.viewLibrary': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['F3'] },
  'game.viewExile': { scope: ShortcutScope.GAME, group: 'gameView', sequences: [] },
  'game.viewSideboard': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['Ctrl+F3'] },
  // View top/bottom cards prompts. Cockatrice uses Ctrl+W / Ctrl+Shift+W
  // — both Chromium-hardcoded (close tab / close window). Rebound.
  'game.viewTopCards': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['Ctrl+Alt+KeyW'] },
  'game.viewBottomCards': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['Ctrl+Alt+Shift+KeyW'] },
  'game.closeRecentView': { scope: ShortcutScope.GAME, group: 'gameView', sequences: ['Escape'] },

  'game.playTop': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: ['Ctrl+KeyY'] },
  'game.moveTopToPlayFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: ['Ctrl+Shift+KeyE'] },
  'game.moveTopToGrave': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: ['Alt+KeyY'] },
  'game.moveTopNToGrave': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: ['Alt+KeyM'] },
  'game.moveTopNToGraveFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: [] },
  'game.moveTopToExile': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: [] },
  'game.moveTopNToExile': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: [] },
  'game.moveTopNToExileFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: [] },
  // Cockatrice's `aMoveTopCardsUntil` (Ctrl+Shift+Y) — opens the
  // "Put top cards on stack until…" dialog; on confirm, iteratively
  // reveals top-of-library into the stack until a name match (or the
  // library empties).
  'game.moveTopUntil': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: ['Ctrl+Shift+KeyY'] },
  'game.moveTopToBottom': { scope: ShortcutScope.GAME, group: 'gameMoveTop', sequences: [] },

  'game.moveBottomToPlay': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomToPlayFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomToGrave': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomNToGrave': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomNToGraveFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomToExile': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomNToExile': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomNToExileFaceDown': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.moveBottomToTop': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.drawBottomCard': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },
  'game.drawBottomCards': { scope: ShortcutScope.GAME, group: 'gameMoveBottom', sequences: [] },

  // Gameplay (desktop ShortcutGroup::Gameplay).
  // Cockatrice's `aDrawArrow` (Alt+A) — starts the draw-arrow pending
  // flow from the first selected battlefield card.
  'game.drawArrow': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Alt+KeyA'] },
  'game.removeLocalArrows': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Ctrl+KeyR'] },
  'game.leaveGame': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Ctrl+KeyQ'] },
  'game.concede': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['F2'] },
  'game.rollDice': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Ctrl+KeyI'] },
  'game.flipCoin': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Ctrl+Shift+KeyI'] },
  'game.shuffleLibrary': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: ['Ctrl+KeyS'] },
  'game.shuffleTopCards': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: [] },
  'game.shuffleBottomCards': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: [] },
  'game.rotateViewCW': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: [] },
  'game.rotateViewCCW': { scope: ShortcutScope.GAME, group: 'gameplay', sequences: [] },

  'game.mulligan': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+KeyM'] },
  'game.mulliganSameSize': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+Shift+KeyM'] },
  'game.mulliganMinusOne': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+Shift+Alt+KeyM'] },
  'game.drawCard': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+KeyD'] },
  'game.drawMultipleCards': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+KeyE'] },
  'game.undoDraw': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+Shift+KeyD'] },
  // Deck-flip toggles. Cockatrice uses Ctrl+N / Ctrl+Shift+N; both
  // are Chromium-hardcoded (new window / new incognito). Rebound per
  // plans/shortcuts.md's "Suggested rebinds" table.
  'game.alwaysRevealTopCard': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+Alt+KeyN'] },
  'game.alwaysLookAtTopCard': { scope: ShortcutScope.GAME, group: 'gameDrawing', sequences: ['Ctrl+Alt+Shift+KeyN'] },

  'game.sortHandByName': { scope: ShortcutScope.GAME, group: 'gameHand', sequences: [] },
  'game.sortHandByType': { scope: ShortcutScope.GAME, group: 'gameHand', sequences: ['Ctrl+Shift+KeyH'] },
  'game.sortHandByManaValue': { scope: ShortcutScope.GAME, group: 'gameHand', sequences: [] },
  'game.revealHandToAll': { scope: ShortcutScope.GAME, group: 'gameHand', sequences: [] },
  'game.revealRandomHandCardToAll': { scope: ShortcutScope.GAME, group: 'gameHand', sequences: [] },

  'game.sayMacro1': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit1'] },
  'game.sayMacro2': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit2'] },
  'game.sayMacro3': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit3'] },
  'game.sayMacro4': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit4'] },
  'game.sayMacro5': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit5'] },
  'game.sayMacro6': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit6'] },
  'game.sayMacro7': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit7'] },
  'game.sayMacro8': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit8'] },
  'game.sayMacro9': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit9'] },
  'game.sayMacro10': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Alt+Digit0'] },
  // Matches Cockatrice desktop's `aFocusChat` (Shift+Return). Fires in
  // text inputs too so the user can jump to chat from search boxes, etc.
  // Ordered last in the game group so it sits at the bottom of the
  // Shortcuts tab (group items follow object-key order).
  'chat.focus': { scope: ShortcutScope.GAME, group: 'game', sequences: ['Shift+Enter', 'Shift+NumpadEnter'] },

  'deck.new': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+Alt+KeyN'] },
  'deck.save': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyS'] },
  'deck.load': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyO'] },
  'deck.addCard': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Equal', 'Shift+Equal', 'NumpadAdd'] },
  'deck.removeCard': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Minus', 'NumpadSubtract'] },
  'deck.undo': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyZ'] },
  'deck.redo': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+KeyY', 'Ctrl+Shift+KeyZ'] },
  'deck.addSearchResult': { scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Enter', 'NumpadEnter'] },
  'deck.addSearchResultToSideboard': {
    scope: ShortcutScope.DECK_EDITOR, group: 'deckEditor', sequences: ['Ctrl+Enter', 'Ctrl+NumpadEnter'],
  },

  'room.sendMessage': { scope: ShortcutScope.ROOM, group: 'room', sequences: ['Enter'] },

  'replays.playPause': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['Space'] },
  'replays.skipForward': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['ArrowRight'] },
  'replays.skipBackward': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['ArrowLeft'] },
  'replays.skipForwardBig': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['Ctrl+ArrowRight'] },
  'replays.skipBackwardBig': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['Ctrl+ArrowLeft'] },
  'replays.toggleFastForward': { scope: ShortcutScope.REPLAYS, group: 'replays', sequences: ['Ctrl+KeyP'] },
};

// Actions that fire even when focus is in a text input. Most shortcuts skip text-input
// targets so typing `=` in a search box doesn't fire deck.addCard.
export const firesInTextInputs: ReadonlySet<ActionId> = new Set<ActionId>([
  'room.sendMessage',
  // Chat focus is meant to jump to the chat input from *anywhere* —
  // including other text inputs (card search, deck-editor filter, etc.).
  'chat.focus',
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
