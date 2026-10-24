import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ZoneName } from '@cockatrice/sockatrice';

import type { GameDialogsActions } from '../../../hooks/dialogs/gameDialogs.types';

import type { SeatSelection } from '../../../hooks/useSeatSelection';
import { selectedHiddenZoneCards } from '../../context-menus/CardContextMenu/handCardMenu.actions';
import { useGameDialogsContext } from '../GameDialogsContext';
import {
  SEAT_SHORTCUT_ACTIONS,
  usePublishSeatShortcuts,
  type SeatShortcutActionId,
  type SeatShortcutOperations,
} from '../SeatShortcutsContext';
import type {
  ManaSymbol,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerCounterViewModel,
  PlayerTargetCommands,
  PlayerZoneCommands,
  SeatMoveDestination,
} from './playerBoard.types';
import { toRecipient } from './revealRecipient';
import type { BattlefieldCardActions, BattlefieldCardOps } from './useBattlefieldCardOps';
import type { HandCardActions } from './useHandCardOps';
import type { LibraryOps } from './useLibraryOps';
import type { LifeControl, useSeatPrompts } from './useSeatPrompts';

type SeatPrompts = ReturnType<typeof useSeatPrompts>;

export interface SeatShortcutSeat {
  seatId: number;
  isSelf: boolean;
  selection: SeatSelection | null;
  selectedCardKeys: ReadonlySet<string>;
  deckCount: number;
  handCount: number;
  alwaysRevealTopCard: boolean;
  alwaysLookAtTopCard: boolean;
  manaCounters: PlayerCounterViewModel['mana'];
  lifeControl: LifeControl | undefined;
  lastToken: SeatPrompts['lastToken'];
  openLifePrompt: SeatPrompts['openLifePrompt'];
  openCounterPrompt: SeatPrompts['openCounterPrompt'];
  openViewLibraryCountPrompt: SeatPrompts['openViewLibraryCountPrompt'];
  openCreateTokenDialog: SeatPrompts['openCreateTokenDialog'];
  openMoveTopUntilDialog: () => void;
  cardOps: BattlefieldCardActions;
  handOps: HandCardActions;
  libraryOps: LibraryOps;
  zoneCommands: PlayerZoneCommands;
  cardCommands: PlayerCardCommands;
  counterCommands: PlayerCounterCommands;
  targetCommands: PlayerTargetCommands;
}

type SeatShortcutDialogs = Pick<GameDialogsActions, 'handleRequestChooseMulligan' | 'handleRequestSortHandBy' | 'openZoneView'>;

type SeatShortcut = (seat: SeatShortcutSeat & SeatShortcutDialogs) => void;

const onSelection = (op: (ops: BattlefieldCardOps) => void): SeatShortcut => ({ cardOps }) => {
  const ops = cardOps.forSelection();
  if (ops) {
    op(ops);
  }
};

const onPlayerCounter = (
  symbol: ManaSymbol,
  op: (seat: SeatShortcutSeat, counter: { id: number; count: number }) => void,
): SeatShortcut => (seat) => {
  const counter = seat.manaCounters?.[symbol];
  if (counter) {
    op(seat, counter);
  }
};

const stepPlayerCounter = (symbol: ManaSymbol, step: 1 | -1) =>
  onPlayerCounter(symbol, (seat, counter) => seat.counterCommands.increment(counter.id, step));

const COUNTER_LABEL_KEY: Record<ManaSymbol, string> = {
  W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colorless', O: 'other',
};

const promptPlayerCounter = (t: TFunction, symbol: ManaSymbol) =>
  onPlayerCounter(symbol, (seat, counter) => seat.openCounterPrompt({
    counterId: counter.id,
    label: t(`GameLog.counter.${COUNTER_LABEL_KEY[symbol]}`),
    currentValue: counter.count,
  }));

const moveSelection = (to: SeatMoveDestination): SeatShortcut => ({ cardOps, handOps }) => {
  (cardOps.forSelection() ?? handOps.forSelection())?.move(to);
};

const onHand = (op: SeatShortcut): SeatShortcut => (seat) => {
  if (seat.handCount > 0) {
    op(seat);
  }
};

const onLibrary = (op: SeatShortcut): SeatShortcut => (seat) => {
  if (seat.deckCount > 0) {
    op(seat);
  }
};

const seatShortcuts = (t: TFunction): Record<SeatShortcutActionId, SeatShortcut> => ({
  'game.mulligan': (seat) => seat.handleRequestChooseMulligan(),
  'game.setLife': (seat) => seat.openLifePrompt(),
  'game.removeLocalArrows': (seat) => seat.targetCommands.clearOwnArrows(),
  'game.doesntUntap': onSelection((ops) => ops.toggleDoesntUntap()),
  'game.moveTopUntil': onLibrary((seat) => seat.openMoveTopUntilDialog()),
  'game.alwaysRevealTopCard': (seat) => seat.zoneCommands.setAlwaysRevealTopCard(!seat.alwaysRevealTopCard),
  'game.alwaysLookAtTopCard': (seat) => seat.zoneCommands.setAlwaysLookAtTopCard(!seat.alwaysLookAtTopCard),
  'game.viewTopCards': onLibrary((seat) => seat.openViewLibraryCountPrompt({ isReversed: false, deckSize: seat.deckCount })),
  'game.viewBottomCards': onLibrary((seat) => seat.openViewLibraryCountPrompt({ isReversed: true, deckSize: seat.deckCount })),
  'game.createToken': (seat) => seat.openCreateTokenDialog(),
  'game.createAnotherToken': (seat) => {
    if (seat.lastToken) {
      seat.cardCommands.createToken(seat.lastToken);
    }
  },
  'game.drawArrow': onSelection((ops) => ops.drawArrow()),
  'game.resetPT': onSelection((ops) => ops.resetPT()),
  'game.reduceLifeByPower': onSelection((ops) => ops.reduceLifeByPower()),
  'game.addStormCounter': stepPlayerCounter('O', 1),
  'game.removeStormCounter': stepPlayerCounter('O', -1),
  'game.setStormCounter': promptPlayerCounter(t, 'O'),
  'game.attachCard': onSelection((ops) => ops.attach()),
  'game.peekCard': onSelection((ops) => ops.peek()),
  'game.flipCard': onSelection((ops) => ops.toggleFaceDown()),
  'game.unattachCard': onSelection((ops) => ops.unattach()),
  'game.moveSelectedToGrave': moveSelection({ zone: ZoneName.GRAVE }),
  'game.setCardPT': onSelection((ops) => ops.promptPT()),
  'game.incP': onSelection((ops) => ops.changePT(1, 0)),
  'game.decP': onSelection((ops) => ops.changePT(-1, 0)),
  'game.incT': onSelection((ops) => ops.changePT(0, 1)),
  'game.decT': onSelection((ops) => ops.changePT(0, -1)),
  'game.incPT': onSelection((ops) => ops.changePT(1, 1)),
  'game.decPT': onSelection((ops) => ops.changePT(-1, -1)),
  'game.selectAllBattlefield': (seat) => seat.cardOps.selectAll(),
  'game.selectRowBattlefield': onSelection((ops) => ops.selectRow()),
  'game.selectColumnBattlefield': onSelection((ops) => ops.selectColumn()),
  'game.addCounterA': onSelection((ops) => ops.stepCounter(0, 1)),
  'game.removeCounterA': onSelection((ops) => ops.stepCounter(0, -1)),
  'game.setCounterA': onSelection((ops) => ops.promptCounter(0)),
  'game.addCounterB': onSelection((ops) => ops.stepCounter(1, 1)),
  'game.removeCounterB': onSelection((ops) => ops.stepCounter(1, -1)),
  'game.setCounterB': onSelection((ops) => ops.promptCounter(1)),
  'game.addCounterC': onSelection((ops) => ops.stepCounter(2, 1)),
  'game.removeCounterC': onSelection((ops) => ops.stepCounter(2, -1)),
  'game.setCounterC': onSelection((ops) => ops.promptCounter(2)),
  'game.incrementAllCardCounters': (seat) => seat.cardOps.incrementAllCounters(),
  'game.setAnnotation': onSelection((ops) => ops.promptAnnotation()),
  'game.moveSelectedToLibraryBottom': moveSelection({ zone: ZoneName.DECK, reversed: true }),
  'game.cloneCard': onSelection((ops) => ops.clone()),
  'game.revealSelectedToAll': (seat) => {
    const picked = selectedHiddenZoneCards(seat.seatId, seat.selection, seat.selectedCardKeys);
    if (picked) {
      seat.zoneCommands.reveal(picked.zone, toRecipient(-1), { cardIds: picked.cardIds });
    }
  },
  'game.tapCard': onSelection((ops) => ops.toggleTapped()),
  'game.playCard': (seat) => seat.handOps.forSelection()?.play(false),
  'game.playCardFaceDown': (seat) => seat.handOps.forSelection()?.play(true),
  'game.createRelatedTokens': onSelection((ops) => ops.createRelatedTokens()),
  'game.moveSelectedToExile': moveSelection({ zone: ZoneName.EXILE }),
  'game.moveSelectedToHand': moveSelection({ zone: ZoneName.HAND }),
  'game.moveSelectedToLibraryTop': moveSelection({ zone: ZoneName.DECK }),
  'game.moveSelectedToBattlefield': moveSelection({ zone: ZoneName.TABLE }),
  'game.viewHand': (seat) => seat.openZoneView({ playerId: seat.seatId, zoneName: ZoneName.HAND }),
  'game.viewExile': (seat) => seat.openZoneView({ playerId: seat.seatId, zoneName: ZoneName.EXILE }),
  'game.sortHandByName': onHand((seat) => seat.handleRequestSortHandBy('name')),
  'game.sortHandByManaValue': onHand((seat) => seat.handleRequestSortHandBy('manacost')),
  'game.revealHandToAll': onHand((seat) => seat.zoneCommands.reveal(ZoneName.HAND, 'all')),
  'game.revealRandomHandCardToAll': onHand((seat) => seat.zoneCommands.reveal(ZoneName.HAND, 'all', 'random')),
  'game.moveTopToPlayFaceDown': ({ libraryOps }) => libraryOps.moveTopCard(ZoneName.TABLE, 'end', true),
  'game.moveTopNToGraveFaceDown': ({ libraryOps }) => libraryOps.promptMoveTopCards(ZoneName.GRAVE, true),
  'game.moveTopToExile': ({ libraryOps }) => libraryOps.moveTopCard(ZoneName.EXILE, 0),
  'game.moveTopNToExile': ({ libraryOps }) => libraryOps.promptMoveTopCards(ZoneName.EXILE),
  'game.moveTopNToExileFaceDown': ({ libraryOps }) => libraryOps.promptMoveTopCards(ZoneName.EXILE, true),
  'game.moveTopToBottom': ({ libraryOps }) => libraryOps.moveTopCard(ZoneName.DECK, 'end'),
  'game.moveBottomToPlay': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.STACK, 'end'),
  'game.moveBottomToPlayFaceDown': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.TABLE, 'end', true),
  'game.moveBottomToGrave': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.GRAVE, 0),
  'game.moveBottomNToGrave': ({ libraryOps }) => libraryOps.promptMoveBottomCards(ZoneName.GRAVE),
  'game.moveBottomNToGraveFaceDown': ({ libraryOps }) => libraryOps.promptMoveBottomCards(ZoneName.GRAVE, true),
  'game.moveBottomToExile': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.EXILE, 0),
  'game.moveBottomNToExile': ({ libraryOps }) => libraryOps.promptMoveBottomCards(ZoneName.EXILE),
  'game.moveBottomNToExileFaceDown': ({ libraryOps }) => libraryOps.promptMoveBottomCards(ZoneName.EXILE, true),
  'game.moveBottomToTop': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.DECK, 0),
  'game.drawBottomCard': ({ libraryOps }) => libraryOps.moveBottomCard(ZoneName.HAND, 0),
  'game.drawBottomCards': ({ libraryOps }) => libraryOps.promptMoveBottomCards(ZoneName.HAND),
  'game.shuffleTopCards': ({ libraryOps }) => libraryOps.promptShuffleTopCards(),
  'game.shuffleBottomCards': ({ libraryOps }) => libraryOps.promptShuffleBottomCards(),
  'game.addCounterD': onSelection((ops) => ops.stepCounter(3, 1)),
  'game.removeCounterD': onSelection((ops) => ops.stepCounter(3, -1)),
  'game.setCounterD': onSelection((ops) => ops.promptCounter(3)),
  'game.addCounterE': onSelection((ops) => ops.stepCounter(4, 1)),
  'game.removeCounterE': onSelection((ops) => ops.stepCounter(4, -1)),
  'game.setCounterE': onSelection((ops) => ops.promptCounter(4)),
  'game.addCounterF': onSelection((ops) => ops.stepCounter(5, 1)),
  'game.removeCounterF': onSelection((ops) => ops.stepCounter(5, -1)),
  'game.setCounterF': onSelection((ops) => ops.promptCounter(5)),
  'game.incLife': (seat) => seat.lifeControl?.onDelta(1),
  'game.decLife': (seat) => seat.lifeControl?.onDelta(-1),
  'game.incManaCounterW': stepPlayerCounter('W', 1),
  'game.decManaCounterW': stepPlayerCounter('W', -1),
  'game.setManaCounterW': promptPlayerCounter(t, 'W'),
  'game.incManaCounterU': stepPlayerCounter('U', 1),
  'game.decManaCounterU': stepPlayerCounter('U', -1),
  'game.setManaCounterU': promptPlayerCounter(t, 'U'),
  'game.incManaCounterB': stepPlayerCounter('B', 1),
  'game.decManaCounterB': stepPlayerCounter('B', -1),
  'game.setManaCounterB': promptPlayerCounter(t, 'B'),
  'game.incManaCounterR': stepPlayerCounter('R', 1),
  'game.decManaCounterR': stepPlayerCounter('R', -1),
  'game.setManaCounterR': promptPlayerCounter(t, 'R'),
  'game.incManaCounterG': stepPlayerCounter('G', 1),
  'game.decManaCounterG': stepPlayerCounter('G', -1),
  'game.setManaCounterG': promptPlayerCounter(t, 'G'),
  'game.incManaCounterX': stepPlayerCounter('C', 1),
  'game.decManaCounterX': stepPlayerCounter('C', -1),
  'game.setManaCounterX': promptPlayerCounter(t, 'C'),
  'game.flowP': onSelection((ops) => ops.changePT(1, -1)),
  'game.flowT': onSelection((ops) => ops.changePT(-1, 1)),
});

export function useSeatShortcutOperations(seat: SeatShortcutSeat): void {
  const { t } = useTranslation();
  const shortcuts = seatShortcuts(t);
  const { handleRequestChooseMulligan, handleRequestSortHandBy, openZoneView } = useGameDialogsContext();
  const context = { ...seat, handleRequestChooseMulligan, handleRequestSortHandBy, openZoneView };
  const operations: SeatShortcutOperations = Object.fromEntries(
    SEAT_SHORTCUT_ACTIONS.map((id) => [id, () => shortcuts[id](context)]),
  );
  usePublishSeatShortcuts(seat.isSelf ? operations : null);
}
