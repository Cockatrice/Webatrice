
import type { ActionId } from '@app/feature-widgets/shortcuts';
import type { TFunction } from 'i18next';

import { counterColorForId } from '../../ui/SeatCard/counterColors';
import type { ContextMenuItem, MenuShortcutFor } from '../ContextMenu/ContextMenu';

export interface BuildCardContextMenuArgs {
  t: TFunction;
  menuShortcut: MenuShortcutFor;
  faceDown: boolean;
  doesntUntap: boolean;
  onTapUntap: () => void;
  onFlip: () => void;
  /** "Peek card" — Cockatrice's `aPeek`. Menu item only appears when
   *  `faceDown` is true. Fires one `Command_RevealCards` per selected
   *  card, revealed to the local player only. */
  onPeek: () => void;
  onSkipUntapping: () => void;
  onClone: () => void;
  onSetAnnotation: () => void;
  onMoveToTop: () => void;
  onMoveToBottom: () => void;
  onMoveToTable: () => void;
  onMoveToHand: () => void;
  onMoveToGrave: () => void;
  onMoveToExile: () => void;
  /** "X cards from the top of library..." — opens a numeric prompt and
   *  moves the source card N positions from the top of its owner's
   *  library on submit. Ports Cockatrice's
   *  `actRequestMoveCardXCardsFromTopDialog` (player_actions.cpp:1220). */
  onMoveToXCardsFromTop: () => void;
  /** P/T submenu handlers. Each mirrors one entry in Cockatrice's
   *  `pt_menu.cpp`. Order: increase power / decrease power / flow P
   *  (P+1, T-1); increase toughness / decrease toughness / flow T
   *  (P-1, T+1); increase both / decrease both; set..., reset. */
  onIncP: () => void;
  onDecP: () => void;
  onFlowP: () => void;
  onIncT: () => void;
  onDecT: () => void;
  onFlowT: () => void;
  onIncPT: () => void;
  onDecPT: () => void;
  onSetPT: () => void;
  onResetPT: () => void;
  /** "Attach to card..." — enters pending-attach mode. The next click on
   *  a battlefield card resolves the attach; Escape or clicking the
   *  source card cancels. Ported behavior from Cockatrice's `actAttach`
   *  (player_actions.cpp:1493-1501). */
  onAttachToCard: () => void;
  /** Gates the "Unattach" menu item. True when the target card is
   *  currently attached to another card (has a valid `attachTargetCardId`).
   *  Cockatrice hides the item entirely when nothing is attached. */
  isAttached: boolean;
  /** "Unattach" — sends `Command_AttachCard` with no target so the
   *  server clears this card's `attachedTo` link. Ports
   *  `PlayerActions::actUnattach` (player_actions.cpp:1503-1517). */
  onUnattach: () => void;
  /** "Draw arrow..." — enters pending-arrow mode. The next click on
   *  a battlefield card OR player life-pill resolves the arrow;
   *  Escape or clicking the source cancels. Ports Cockatrice's
   *  `actDrawArrow` → `CardItem::drawArrow(Qt::red)`. */
  onDrawArrow: () => void;
  /** "Reduce life by power" — sums the power of every selected card
   *  (or just this card when there's no selection) and subtracts from
   *  the life total. Ports `PlayerActions::actReduceLifeByPower`
   *  (player_actions.cpp:1432-1455). */
  onReduceLifeByPower: () => void;
  /** "Select All" — marquees every card in this card's zone (the
   *  battlefield, since the menu is only reachable from the board).
   *  Ports `PlayerActions::actSelectAll` (player_actions.cpp:720-728). */
  onSelectAll: () => void;
  /** "Select Row" — marquees every battlefield card in the same visual
   *  row (`slot.row`) as this card. Ports `actSelectRow`
   *  (player_actions.cpp:730-741). */
  onSelectRow: () => void;
  /** "Add counter (X)" — increments the counter at slot `counterId` by
   *  1. Ports `PlayerActions::actAddCardCounter` (player_actions.cpp:1519). */
  onAddCardCounter: (counterId: number) => void;
  /** "Set counters (X)..." — opens a numeric modal to set the counter
   *  at slot `counterId` to an absolute value. Ports
   *  `actRequestSetCardCounterDialog` / `actSetCardCounter`. */
  onSetCardCounter: (counterId: number) => void;
  /** Pre-built "Token: …" items appended to the bottom of the menu.
   *  Cockatrice's addRelatedCardActions (card_menu.cpp:407-479)
   *  iterates the card's related + reverse-related lists and adds
   *  one QAction per entry; we do the same in the caller and hand
   *  the finished items in so this builder stays wire-agnostic
   *  (no Dexie / token lookups needed here). */
  tokenItems?: ContextMenuItem[];
  relatedViewItems?: ContextMenuItem[];
}

export function buildCardContextMenu(args: BuildCardContextMenuArgs): ContextMenuItem[] {
  const counterItems: ContextMenuItem[] = [];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
  // [Add, Set] shortcut actions per counter slot, read through
  // menuShortcut so rebinds update the menu chip immediately.
  // A/B/C ship Cockatrice defaults (Alt+. / Ctrl+. / Ctrl+>);
  // D/E/F have no default binding but can be bound.
  const counterShortcuts: [ActionId, ActionId][] = letters.map((letter) => [
    `game.addCounter${letter}`,
    `game.setCounter${letter}`,
  ]);
  letters.forEach((letter, i) => {
    if (i > 0) {
      counterItems.push({ divider: true });
    }
    counterItems.push({
      label: args.t('CardMenu.addCounter', { letter }),
      ...(counterShortcuts[i] && args.menuShortcut(counterShortcuts[i][0])),
      swatch: counterColorForId(i),
      onClick: () => args.onAddCardCounter(i),
    });
    counterItems.push({
      label: args.t('CardMenu.setCounters', { letter }),
      ...(counterShortcuts[i] && args.menuShortcut(counterShortcuts[i][1])),
      swatch: counterColorForId(i),
      onClick: () => args.onSetCardCounter(i),
    });
  });

  return [
    { label: args.t('CardMenu.tapUntap'), ...args.menuShortcut('game.tapCard'), onClick: args.onTapUntap },
    {
      label: args.t('CardMenu.skipUntapping'),
      ...args.menuShortcut('game.doesntUntap'),
      checked: args.doesntUntap,
      onClick: args.onSkipUntapping,
    },
    {
      label: args.faceDown ? args.t('CardMenu.turnOverFaceUp') : args.t('CardMenu.turnOver'),
      ...args.menuShortcut('game.flipCard'),
      onClick: args.onFlip,
    },
    // Peek — only shown on face-down cards. Reveals the card to the
    // local player without flipping it (mirrors Cockatrice's aPeek).
    ...(args.faceDown
      ? [{ label: args.t('CardMenu.peek'), ...args.menuShortcut('game.peekCard'), onClick: args.onPeek } as ContextMenuItem]
      : []),
    { divider: true },
    { label: args.t('CardMenu.clone'), ...args.menuShortcut('game.cloneCard'), onClick: args.onClone },
    {
      label: args.t('CardMenu.moveTo'),
      submenu: [
        {
          label: args.t('CardMenu.topLibraryRandom'),
          ...args.menuShortcut('game.moveSelectedToLibraryTop'),
          onClick: args.onMoveToTop,
        },
        { label: args.t('CardMenu.xFromTop'), onClick: args.onMoveToXCardsFromTop },
        {
          label: args.t('CardMenu.bottomLibraryRandom'),
          ...args.menuShortcut('game.moveSelectedToLibraryBottom'),
          onClick: args.onMoveToBottom,
        },
        { divider: true },
        { label: args.t('CardMenu.table'), ...args.menuShortcut('game.moveSelectedToBattlefield'), onClick: args.onMoveToTable },
        { label: args.t('ZoneLabel.title.hand'), ...args.menuShortcut('game.moveSelectedToHand'), onClick: args.onMoveToHand },
        { divider: true },
        {
          label: args.t('ZoneLabel.title.grave'),
          ...args.menuShortcut('game.moveSelectedToGrave'),
          onClick: args.onMoveToGrave,
        },
        { label: args.t('ZoneLabel.title.rfg'), ...args.menuShortcut('game.moveSelectedToExile'), onClick: args.onMoveToExile },
      ],
    },
    { divider: true },
    {
      label: args.t('CardMenu.attach'),
      ...args.menuShortcut('game.attachCard'),
      onClick: args.onAttachToCard,
    },
    // Cockatrice hides "Unattach" for cards that aren't attached — only
    // include the item when there's actually something to detach.
    ...(args.isAttached
      ? [{ label: args.t('CardMenu.unattach'), ...args.menuShortcut('game.unattachCard'), onClick: args.onUnattach } as ContextMenuItem]
      : []),
    {
      label: args.t('CardMenu.drawArrow'),
      ...args.menuShortcut('game.drawArrow'),
      onClick: args.onDrawArrow,
    },
    { divider: true },
    {
      label: args.t('CardMenu.powerToughness'),
      submenu: [
        { label: args.t('CardMenu.increasePower'), ...args.menuShortcut('game.incP'), onClick: args.onIncP },
        { label: args.t('CardMenu.decreasePower'), ...args.menuShortcut('game.decP'), onClick: args.onDecP },
        {
          label: args.t('CardMenu.increasePowerDecreaseToughness'),
          ...args.menuShortcut('game.flowP'),
          onClick: args.onFlowP,
        },
        { divider: true },
        { label: args.t('CardMenu.increaseToughness'), ...args.menuShortcut('game.incT'), onClick: args.onIncT },
        { label: args.t('CardMenu.decreaseToughness'), ...args.menuShortcut('game.decT'), onClick: args.onDecT },
        {
          label: args.t('CardMenu.decreasePowerIncreaseToughness'),
          ...args.menuShortcut('game.flowT'),
          onClick: args.onFlowT,
        },
        { divider: true },
        { label: args.t('CardMenu.increasePowerToughness'), ...args.menuShortcut('game.incPT'), onClick: args.onIncPT },
        { label: args.t('CardMenu.decreasePowerToughness'), ...args.menuShortcut('game.decPT'), onClick: args.onDecPT },
        { divider: true },
        { label: args.t('CardMenu.setPowerToughness'), ...args.menuShortcut('game.setCardPT'), onClick: args.onSetPT },
        { label: args.t('CardMenu.resetPowerToughness'), ...args.menuShortcut('game.resetPT'), onClick: args.onResetPT },
      ],
    },
    {
      label: args.t('CardMenu.setAnnotation'),
      ...args.menuShortcut('game.setAnnotation'),
      onClick: args.onSetAnnotation,
    },
    { divider: true },
    {
      label: args.t('CardMenu.reduceLifeByPower'),
      ...args.menuShortcut('game.reduceLifeByPower'),
      onClick: args.onReduceLifeByPower,
    },
    { divider: true },
    { label: args.t('CardMenu.selectAll'), ...args.menuShortcut('game.selectAllBattlefield'), onClick: args.onSelectAll },
    { label: args.t('CardMenu.selectRow'), ...args.menuShortcut('game.selectRowBattlefield'), onClick: args.onSelectRow },
    { divider: true },
    { label: args.t('CardMenu.cardCounters'), submenu: counterItems },
    ...(args.relatedViewItems ?? []),
    // "Token: …" items — mirrors Cockatrice's addRelatedCardActions
    // (card_menu.cpp:407-479). The parent caller resolves each token
    // name into a menu item (label + onClick) and passes them in as
    // a flat array; we tack them on after Card counters and prefix
    // with a divider when non-empty so the shape stays 1:1 with
    // desktop's menu. Empty when the card has no related list or
    // none of its related names resolve in the tokens table.
    ...(args.tokenItems && args.tokenItems.length > 0
      ? [{ divider: true } as ContextMenuItem, ...args.tokenItems]
      : []),
  ];
}

export interface BuildOpponentCardMenuArgs {
  t: TFunction;
  menuShortcut: MenuShortcutFor;
  onDrawArrow: () => void;
  onClone: () => void;
  onReduceLifeByPower: () => void;
  onSelectAll: () => void;
  onSelectRow: () => void;
  tokenItems?: ContextMenuItem[];
  relatedViewItems?: ContextMenuItem[];
}

export function buildOpponentCardMenu(args: BuildOpponentCardMenuArgs): ContextMenuItem[] {
  return [
    { label: args.t('CardMenu.drawArrow'), ...args.menuShortcut('game.drawArrow'), onClick: args.onDrawArrow },
    { label: args.t('CardMenu.clone'), ...args.menuShortcut('game.cloneCard'), onClick: args.onClone },
    { divider: true },
    {
      label: args.t('CardMenu.reduceLifeByPower'),
      ...args.menuShortcut('game.reduceLifeByPower'),
      onClick: args.onReduceLifeByPower,
    },
    { divider: true },
    { label: args.t('CardMenu.selectAll'), ...args.menuShortcut('game.selectAllBattlefield'), onClick: args.onSelectAll },
    { label: args.t('CardMenu.selectRow'), ...args.menuShortcut('game.selectRowBattlefield'), onClick: args.onSelectRow },
    ...(args.relatedViewItems ?? []),
    ...(args.tokenItems && args.tokenItems.length > 0
      ? [{ divider: true } as ContextMenuItem, ...args.tokenItems]
      : []),
  ];
}
