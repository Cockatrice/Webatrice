import type { ActionId, MenuShortcut } from '@app/feature-widgets/shortcuts';
import { useMessageMacros } from '@app/hooks';
import { useTranslation } from 'react-i18next';

import type { ContextMenuItem, MenuShortcutFor } from '../../context-menus/ContextMenu/ContextMenu';
import { MANA_COLORS } from '../../right-sidebar/PlayerInfoPanel/manaColors';
import { useTallyType } from '../../../hooks/useTallyType';
import { useGameDialogActions } from '../../ui/GameDialogActionsContext';
import { useGameDialogsContext } from '../../ui/GameDialogsContext';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerCounterViewModel,
} from '../../ui/PlayerBoard/playerBoard.types';
import type { LifeControl, useSeatPrompts } from '../../ui/PlayerBoard/useSeatPrompts';
import { buildCustomZonesMenu } from './customZonesMenu';
import { buildSayMenu } from './sayMenu';
import { buildTallyMenu } from './tallyMenu';

type SeatPrompts = ReturnType<typeof useSeatPrompts>;

export interface UseBattlefieldMenuItemsArgs {
  seatId: number;
  customZones: readonly { name: string }[];
  onSay: ((message: string) => void) | undefined;
  handMenuItems: ContextMenuItem[];
  libraryMenuItems: ContextMenuItem[];
  graveMenuItemsSelf: ContextMenuItem[];
  graveMenuItemsOpponent: ContextMenuItem[];
  exileMenuItemsSelf: ContextMenuItem[];
  exileMenuItemsOpponent: ContextMenuItem[];
  lifeControl: LifeControl | undefined;
  openLifePrompt: () => void;
  openCounterPrompt: SeatPrompts['openCounterPrompt'];
  manaCounters: PlayerCounterViewModel['mana'];
  incrementAllCardCounters: () => void;
  battlefieldDisplayList: readonly BattlefieldCardViewModel[];
  lastToken: SeatPrompts['lastToken'];
  openCreateTokenDialog: () => void;
  menuShortcut: MenuShortcutFor;
  cardCommands: PlayerCardCommands;
  counterCommands: PlayerCounterCommands;
}

export function useBattlefieldMenuItems({
  seatId,
  customZones,
  onSay,
  handMenuItems,
  libraryMenuItems,
  graveMenuItemsSelf,
  graveMenuItemsOpponent,
  exileMenuItemsSelf,
  exileMenuItemsOpponent,
  lifeControl,
  openLifePrompt,
  openCounterPrompt,
  manaCounters,
  incrementAllCardCounters,
  battlefieldDisplayList,
  lastToken,
  openCreateTokenDialog,
  menuShortcut,
  cardCommands,
  counterCommands,
}: UseBattlefieldMenuItemsArgs) {
  const { t } = useTranslation();
  const { onRequestRollDie, onRequestGameInfo, onRequestViewSideboard } = useGameDialogActions();
  const { openZoneView } = useGameDialogsContext();
  const [tallyType, setTallyType] = useTallyType();
  const tallyMenu = buildTallyMenu(t, tallyType, setTallyType);
  const messageMacros = useMessageMacros();

  // Counters submenu — Cockatrice's AbstractCounter builds a menu per
  // counter with "Set counter..." + ±1..±10 rows (abstract_counter.cpp:36-57).
  // We already have all the wires for these: `lifeControl.onDelta` /
  // `.onSet` for life, and `counterCommands.increment(id, delta)` for the mana
  // pool. Just build the delta list programmatically and hand it to
  // each counter's submenu. "Set counter..." on Life reuses the
  // existing Ctrl+L modal; mana counters don't have a set-modal yet
  // so their Set row is disabled.
  // The +1 / -1 rows show the counter's add / remove shortcut.
  const buildDeltaItems = (
    apply: (delta: number) => void,
    hints: { inc: MenuShortcut; dec: MenuShortcut },
  ): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    // +10 down to +1
    for (let i = 10; i >= 1; i--) {
      items.push({ label: `+${i}`, onClick: () => apply(i), ...(i === 1 ? hints.inc : null) });
    }
    items.push({ divider: true });
    // -1 down to -10
    for (let i = 1; i <= 10; i++) {
      items.push({ label: `-${i}`, onClick: () => apply(-i), ...(i === 1 ? hints.dec : null) });
    }
    return items;
  };
  const counterHints = (inc: ActionId, dec: ActionId, set: ActionId) => ({
    inc: menuShortcut(inc),
    dec: menuShortcut(dec),
    set: menuShortcut(set),
  });
  const manaHints: Record<(typeof MANA_COLORS)[number]['symbol'], ReturnType<typeof counterHints>> = {
    W: counterHints('game.incManaCounterW', 'game.decManaCounterW', 'game.setManaCounterW'),
    U: counterHints('game.incManaCounterU', 'game.decManaCounterU', 'game.setManaCounterU'),
    B: counterHints('game.incManaCounterB', 'game.decManaCounterB', 'game.setManaCounterB'),
    R: counterHints('game.incManaCounterR', 'game.decManaCounterR', 'game.setManaCounterR'),
    G: counterHints('game.incManaCounterG', 'game.decManaCounterG', 'game.setManaCounterG'),
    C: counterHints('game.incManaCounterX', 'game.decManaCounterX', 'game.setManaCounterX'),
    O: counterHints('game.addStormCounter', 'game.removeStormCounter', 'game.setStormCounter'),
  };
  const lifeHints = counterHints('game.incLife', 'game.decLife', 'game.setLife');
  const lifeCounterItems: ContextMenuItem[] = [
    {
      label: t('PlayerMenu.setCounter'),
      onClick: () => openLifePrompt(),
      disabled: !lifeControl,
      ...lifeHints.set,
    },
    { divider: true },
    ...buildDeltaItems((d) => lifeControl?.onDelta(d), lifeHints),
  ];
  const manaCounterSubmenus: ContextMenuItem[] = MANA_COLORS.map((m) => {
    const counter = manaCounters?.[m.symbol];
    const canModify = counter != null;
    const canSet = counter != null;
    return {
      label: t(`PlayerInfoPanel.mana.${m.symbol}`),
      // Disable the whole counter's submenu when we don't have a
      // counter id from Redux (pre-hydration transient) — every row
      // inside would no-op anyway.
      disabled: !canModify,
      submenu: [
        {
          // The same sum prompt Ctrl+L opens, titled with the
          // counter name. Fires Command_SetCounter with the
          // absolute value.
          label: t('PlayerMenu.setCounter'),
          onClick: () => {
            if (counter) {
              openCounterPrompt({
                counterId: counter.id,
                label: t(`PlayerInfoPanel.mana.${m.symbol}`),
                currentValue: counter.count,
              });
            }
          },
          disabled: !canSet,
          ...manaHints[m.symbol].set,
        },
        { divider: true },
        ...buildDeltaItems((d) => {
          if (canModify) {
            counterCommands.increment(counter.id, d);
          }
        }, manaHints[m.symbol]),
      ],
    };
  });
  const countersMenuItems: ContextMenuItem[] = [
    { label: t('GameLog.counter.life'), submenu: lifeCounterItems },
    ...manaCounterSubmenus,
  ];

  // Rest of the battlefield menu — pile submenus are placeholders
  // (already wired on the piles themselves), utility items wire
  // Roll die and Game info via GameDialogActionsContext. Everything
  // else stays disabled with the correct label so the menu reads
  // identical in shape to Cockatrice's PlayerMenu.
  const battlefieldMenuItems: ContextMenuItem[] = [
    {
      label: t('ZoneLabel.title.hand'),
      submenu: handMenuItems,
    },
    {
      // Same items as right-clicking the library pile. Cockatrice's
      // PlayerMenu attaches the same LibraryMenu to both places
      // (player_menu.cpp:23,67).
      label: t('ZoneLabel.title.deck'),
      submenu: libraryMenuItems,
    },
    {
      // Same items as right-clicking the graveyard pile. Cockatrice's
      // PlayerMenu attaches the same GraveyardMenu to both places
      // (player_menu.cpp:29,63). Top-level entry stays enabled even
      // when the pile is empty so the user can still open "View
      // graveyard" — individual submenu items handle their own
      // per-pile-count disabling.
      label: t('ZoneLabel.title.grave'),
      submenu: graveMenuItemsSelf,
    },
    {
      // Same items as right-clicking the exile pile. Cockatrice's
      // PlayerMenu attaches the same RfgMenu to both places
      // (player_menu.cpp:30,64).
      label: t('ZoneLabel.title.rfg'),
      submenu: exileMenuItemsSelf,
    },
    {
      label: t('ZoneLabel.title.sb'),
      submenu: [
        {
          // Cockatrice's actViewSideboard opens the same zone-view
          // dialog that "View library" opens (player_actions.cpp:232-234).
          label: t('ShortcutsTab.action.game.viewSideboard'),
          onClick: onRequestViewSideboard,
          ...menuShortcut('game.viewSideboard'),
        },
      ],
    },
    ...buildCustomZonesMenu(t, customZones, (zoneName) => openZoneView({ playerId: seatId, zoneName })),
    { divider: true },
    {
      // Counters submenu — Cockatrice's countersMenu lists every
      // per-player counter (life + w/u/b/r/g/x/storm) as its own
      // ±N/Set submenu (AbstractCounter, abstract_counter.cpp:36-57).
      // We already wire the deltas via lifeControl.onDelta and
      // counterCommands.increment, and life's Set via the Ctrl+L modal.
      label: t('PlayerMenu.counters'),
      submenu: countersMenuItems,
    },
    {
      label: t('ShortcutsTab.action.game.incrementAllCardCounters'),
      ...menuShortcut('game.incrementAllCardCounters'),
      onClick: incrementAllCardCounters,
      disabled:
        battlefieldDisplayList.length === 0,
    },
    { divider: true },
    {
      // "Untap all permanents" — port of Cockatrice's actUntapAll.
      // Fires one Command_SetCardAttr with cardId=-1 (Servatrice's
      // "all cards in zone" sentinel), which the server iterates
      // over every card in TABLE and untaps each while respecting
      // per-card `doesntUntap` flags (server_card.cpp:70). This is
      // the same wire the phase-tracker's untap-step double-click
      // fires (usePhaseBar.ts:41-51) — one wire, whole battlefield.
      // Not phase-gated here — the menu action is always available.
      label: t('PlayerMenu.untapAll'),
      onClick: () => cardCommands.untapAll(),
      ...menuShortcut('game.untapAll'),
    },
    { divider: true },
    {
      label: t('PlayerMenu.rollDie'),
      onClick: () => onRequestRollDie?.(),
      ...menuShortcut('game.rollDice'),
    },
    {
      // "Flip coin" — port of actFlipCoin (player_actions.cpp:866-872).
      // Cockatrice models a coin flip as a `Command_RollDie(sides=2,
      // count=1)`; server broadcasts Event_RollDie and the chat log
      // renders the heads/tails outcome.
      label: t('ShortcutsTab.action.game.flipCoin'),
      onClick: () => counterCommands.flipCoin(),
      ...menuShortcut('game.flipCoin'),
    },
    { divider: true },
    {
      // "Create token..." — opens the modal, on submit fires
      // Command_CreateToken and snapshots the payload into lastToken
      // so "Create another token" can re-fire without the modal.
      // Matches Cockatrice's actCreateToken (player_actions.cpp:878-892):
      // stores lastTokenInfo, then chains into actCreateAnotherToken.
      label: t('PlayerMenu.createToken'),
      onClick: () => openCreateTokenDialog(),
      ...menuShortcut('game.createToken'),
    },
    {
      // "Create another token" — direct re-fire with the last submitted
      // args. Mirrors Cockatrice's actCreateAnotherToken which early-
      // returns when lastTokenInfo.name is empty (player_actions.cpp:895);
      // we disable the menu item instead so the state matches Cockatrice's
      // "enable" signal (requestEnableAndSetCreateAnotherTokenAction).
      label: t('ShortcutsTab.action.game.createAnotherToken'),
      onClick: () => {
        if (lastToken) {
          cardCommands.createToken(lastToken);
        }
      },
      disabled: !lastToken,
      ...menuShortcut('game.createAnotherToken'),
    },
    {
      label: t('PlayerMenu.createPredefinedToken'),
      // Populated at runtime from the deck's tokens zone in Cockatrice.
      disabled: true,
    },
    { divider: true },
    {
      label: t('PlayerMenu.gameInfo'),
      onClick: () => onRequestGameInfo?.(),
    },
    tallyMenu,
    ...(onSay ? [buildSayMenu(t, messageMacros, menuShortcut, onSay)] : []),
  ];

  // Opponent battlefield right-click menu. Ports Cockatrice's
  // player_menu.cpp:14-58 opponent branch: all utility items (Create
  // token, Roll die, Counters, Untap all, Hand / Library / Sideboard
  // submenus) are OWN-ONLY, so the opponent menu narrows to just the
  // two public zones you can peek at — graveyard and exile — plus the
  // menus every player's menu carries (Tally, player_menu.cpp:48). Reuses
  // the same opponent grave/exile item arrays the pile-level menus
  // already attach so "View graveyard" opens the same LibrarySearch
  // dialog either way.
  const opponentBattlefieldMenuItems: ContextMenuItem[] = [
    { label: t('ZoneLabel.title.grave'), submenu: graveMenuItemsOpponent },
    { label: t('ZoneLabel.title.rfg'), submenu: exileMenuItemsOpponent },
    tallyMenu,
  ];

  return {
    battlefieldMenuItems,
    opponentBattlefieldMenuItems,
  };
}
