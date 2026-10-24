import { useCallback, useMemo, useRef } from 'react';
import { ZoneName, type ZoneNameValue } from '@cockatrice/sockatrice';
import { useMenuShortcut } from '@app/feature-widgets/shortcuts';
import { useBoardAnimations, usePreference } from '@app/hooks';
import { useTranslation } from 'react-i18next';

import { useMoveTopUntil } from '../../../hooks/useMoveTopUntil';
import { useSeatSelection, type SeatSelectionZone } from '../../../hooks/useSeatSelection';
import {
  SEAT_CARD_HEIGHT_PX as CARD_H_PX_BASE,
  SEAT_CARD_WIDTH_PX as CARD_W_PX_BASE,
} from '../../battlefield/Battlefield/battlefieldLayout';
import { useBattlefieldMenuItems } from '../../battlefield/Battlefield/useBattlefieldMenuItems';
import type { ContextMenuItem } from '../../context-menus/ContextMenu/ContextMenu';
import { buildRelatedViewItems } from '../../context-menus/CardContextMenu/relatedCardActions';
import { useCardPreviewActions } from '../CardPreviewContext';
import {
  STACK_MIN_CARD_VISIBLE_PX,
  VERTICAL_PILE_X_SPACE_PX,
  type VerticalPileOptions,
} from '../VerticalPile/verticalPile';
import { useCardScale } from '../CardScaleContext';
import { usePendingTargetContext } from '../PendingTargetContext';
import { useGameDialogsContext } from '../GameDialogsContext';
import { EMPTY_CARD_KEYS, useGameSelectionState } from '../GameSelectionContext';
import { useHandMenuItems } from '../HandZone/useHandMenuItems';
import { useActiveSeatDrag } from '../SeatDragContext';
import { useLibraryMenuItems } from '../ZoneStack/useLibraryMenuItems';
import { usePileMenus } from '../ZoneStack/usePileMenus';
import type {
  ArrowTarget,
  PlayerBoardCommands,
  PlayerBoardModel,
  PlayerCardViewModel,
} from './playerBoard.types';
import { useBattlefieldCardOps } from './useBattlefieldCardOps';
import { useHandCardOps } from './useHandCardOps';
import { useLibraryOps } from './useLibraryOps';
import { useDrawFlights } from './useDrawFlights';
import { useSeatCardMetadata } from './useSeatCardMetadata';
import { useSeatClickToPlay } from './useSeatClickToPlay';
import { useSeatDnd } from './useSeatDnd';
import { useKeyboardMove } from '../KeyboardMoveContext';
import { useSeatMarquee } from './useSeatMarquee';
import { useSeatPrompts } from './useSeatPrompts';
import { useSeatShortcutOperations } from './useSeatShortcutOperations';
import { seatGrid as buildSeatGrid } from './seatGrid';

const NO_CARD_IDS: readonly number[] = [];

export type PlayerSeatProps = {
  model: PlayerBoardModel;
  commands: PlayerBoardCommands;
  onOpenDeckInEditor?: () => void;
  onSay?: (message: string) => void;
};

export function usePlayerSeat({ model, commands, onOpenDeckInEditor, onSay }: PlayerSeatProps) {
  const { t } = useTranslation();
  const { seat, zones, counters } = model;
  const {
    zone: zoneCommands,
    card: cardCommands,
    counter: counterCommands,
    target: targetCommands,
  } = commands;
  const {
    playerId,
    isLocal: isSelf,
    isActive,
    mirrored: handOnTop,
    handPlacement,
    flipHandCardBacks,
    revealTargets,
    drawSeq,
    lastDrawCount,
  } = seat;
  const deckCards = model.deck;
  const otherVisibleCards = useMemo(
    () => [
      zones.stack.cards,
      zones.graveyard.cards,
      zones.exile.cards,
      zones.library.revealedCards,
      zones.sideboard.revealedCards,
      ...(zones.customZones ?? []).map((zone) => zone.cards),
    ],
    [zones.stack.cards, zones.graveyard.cards, zones.exile.cards,
      zones.library.revealedCards, zones.sideboard.revealedCards, zones.customZones],
  );
  const manaCounters = counters.mana;
  const { alwaysRevealTopCard, alwaysLookAtTopCard, topCard: deckTopCard } = zones.library;
  const lifeCounter = counters.life;
  const lifeControl = useMemo(() => lifeCounter && {
    value: lifeCounter.value,
    onDelta: (delta: number) => counterCommands.increment(lifeCounter.id, delta),
    onSet: (value: number) => counterCommands.set(lifeCounter.id, value),
  }, [lifeCounter, counterCommands]);
  const name = seat.displayName;
  const {
    openZoneView,
    openMoveTopUntil,
    seatCardMenu,
    openSeatCardMenu,
    closeSeatCardMenu,
  } = useGameDialogsContext();

  const { scale } = useCardScale();
  const CARD_W_PX = CARD_W_PX_BASE * scale;
  const CARD_H_PX = CARD_H_PX_BASE * scale;
  const overlapPercent = usePreference('verticalCardOverlapPercent');
  const handPileOptions = useMemo<VerticalPileOptions>(
    () => ({ overlapPercent, xSpace: VERTICAL_PILE_X_SPACE_PX * scale }),
    [overlapPercent, scale],
  );
  const stackPileOptions = useMemo<VerticalPileOptions>(
    () => ({ ...handPileOptions, minOffset: STACK_MIN_CARD_VISIBLE_PX * scale }),
    [handPileOptions, scale],
  );

  const horizontalHandPreference = usePreference('horizontalHand');
  const inlineHand = handPlacement === 'inline';
  const horizontalHand = !inlineHand || horizontalHandPreference;
  const seatGrid = useMemo(
    () => buildSeatGrid({ horizontalHand, handOnTop, inlineHand }),
    [horizontalHand, handOnTop, inlineHand],
  );

  const {
    cardMetaByName,
    setCardMetaByName,
    tokenMetaByName,
    resolveFaceImageUri,
    describeCard,
  } = useSeatCardMetadata({ isSelf, deckCards, battlefieldCards: zones.battlefield.cards, otherVisibleCards });
  const { showCardInfo } = useCardPreviewActions();
  const relatedViewItemsFor = (cardName: string): ContextMenuItem[] =>
    buildRelatedViewItems(
      t,
      cardMetaByName.get(cardName)?.related ?? [],
      (name) => tokenMetaByName.get(name)?.found ?? false,
      (ref) => {
        showCardInfo({ name: ref.name, scryfallId: ref.scryfallId });
        closeSeatCardMenu();
      },
    );

  const deckCount = zones.library.cardCount ?? 0;

  // Refs for measuring the library card and hand zone positions so we can
  // animate a card back travelling between them.
  const libraryRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);

  const { flights, DRAW_ANIMATION_MS } = useDrawFlights({
    drawSeq,
    lastDrawCount,
    libraryRef,
    handRef,
    enabled: useBoardAnimations(),
  });

  const draw = (n: number) => {
    // Server pops N off the top of the deck and broadcasts
    // Event_DrawCards; Redux updates hand + deck.cardCount from the
    // event, and the draw beacon starts the library→hand flights.
    zoneCommands.draw(n);
  };

  const graveyardRef = useRef<HTMLDivElement>(null);
  const exileRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  // Marquee selection. Selection is single-zone — the marquee groups whatever
  // it touches by zone and picks the zone contributing the most cards. It is
  // this seat's share of the game-level selection, so selecting anywhere else
  // (own or opponent seat) clears it.
  const selectableCards = useMemo(
    () => ({
      hand: zones.hand.cards,
      battlefield: zones.battlefield.cards,
      stack: zones.stack.cards,
    }),
    [zones.hand.cards, zones.battlefield.cards, zones.stack.cards],
  );
  const { selection, setSelection, clearAllSelection } = useSeatSelection(playerId, selectableCards);
  const seatId = playerId;
  const activeSeatDrag = useActiveSeatDrag();
  const seatDrag = activeSeatDrag?.seatPlayerId === seatId ? activeSeatDrag : null;
  const menuOwnerId = playerId;
  const gameSelection = useGameSelectionState();
  const seatMenu = seatCardMenu?.playerId === menuOwnerId ? seatCardMenu : null;
  const cardContextMenu = seatMenu?.kind === 'battlefield' ? seatMenu : null;
  const pileCardMenu = seatMenu?.kind === 'pile' ? seatMenu : null;
  const stackCardMenu = seatMenu?.kind === 'stack' ? seatMenu : null;
  const handCardMenu = seatMenu?.kind === 'hand' ? seatMenu : null;
  const zoneViewCardMenu = seatMenu?.kind === 'zoneView' ? seatMenu : null;
  // The seat root — used both to bound the marquee-start (only clicks
  // inside this box begin a marquee) and to query card elements when
  // finalizing the selection.
  const boxRef = useRef<HTMLDivElement>(null);

  const battlefieldDisplayList = zones.battlefield.cards;

  const menuShortcut = useMenuShortcut();

  const { marquee, onPointerDownBox } = useSeatMarquee({ playerId, handRef, stackRef, setSelection, clearAllSelection });

  const {
    life,
    setLife,
    openLifePrompt,
    openCounterPrompt,
    openAnnotationPrompt,
    openPTPrompt,
    openMoveXFromTopPrompt,
    openCountPrompt,
    openDrawCardsPrompt,
    openViewLibraryCountPrompt,
    openRevealTopCardsPrompt,
    openCardCounterPrompt,
    openTokenCountPrompt,
    lastToken,
    setLastToken,
    openCreateTokenDialog,
  } = useSeatPrompts({
    seatId,
    lifeControl,
    battlefieldCards: battlefieldDisplayList,
    cardMetaByName,
    draw,
    zoneCommands,
    cardCommands,
    counterCommands,
  });
  const pendingTarget = usePendingTargetContext();
  const seatPending = pendingTarget.pending?.source.playerId === playerId ? pendingTarget.pending : null;
  const attachPending = useMemo(
    () => (seatPending?.kind === 'attach'
      ? { sourceCardId: seatPending.source.cardId, sourceCardName: seatPending.source.name }
      : null),
    [seatPending],
  );
  const attachExtraSourceIds = seatPending?.kind === 'attach' ? seatPending.extraSourceIds : NO_CARD_IDS;
  const { startArrow: startPendingArrow, startAttach: startPendingAttach, pickAttachTarget, pickArrowAt } = pendingTarget;
  const attachPicking = pendingTarget.pending?.kind === 'attach';
  const startDrawArrow = useCallback(
    ({ sourceCardId, sourceCardName, sourceZone }: { sourceCardId: number; sourceCardName: string; sourceZone: string }) =>
      startPendingArrow({ playerId, zone: sourceZone, cardId: sourceCardId, name: sourceCardName }),
    [startPendingArrow, playerId],
  );
  const startAttach = useCallback(
    (sourceCardIds: readonly number[], anchorName: string, sourceZone: ZoneNameValue = ZoneName.TABLE) => {
      const [anchorId, ...extraIds] = sourceCardIds;
      startPendingAttach({ playerId, zone: sourceZone, cardId: anchorId, name: anchorName }, extraIds);
    },
    [startPendingAttach, playerId],
  );
  const startTableArrow = useCallback(
    (sourceCardId: number, sourceCardName: string) => startDrawArrow({ sourceCardId, sourceCardName, sourceZone: ZoneName.TABLE }),
    [startDrawArrow],
  );
  const battlefieldTarget = (card: { id: string; ownerPlayerId?: number }): ArrowTarget => {
    const onTable = zones.battlefield.cards.find((c) => c.id === card.id);
    return {
      kind: 'card',
      playerId: card.ownerPlayerId ?? onTable?.ownerPlayerId ?? playerId,
      zone: ZoneName.TABLE,
      cardId: Number(card.id),
      attached: onTable?.attachTargetCardId != null && onTable.attachTargetCardId >= 0,
    };
  };
  const resolveAttachPress = (card: { id: string; ownerPlayerId?: number }) =>
    attachPicking && pickAttachTarget(battlefieldTarget(card));
  const cardOps = useBattlefieldCardOps({
    cards: battlefieldDisplayList,
    selection,
    setSelection,
    cardMetaByName,
    tokenMetaByName,
    deckCount,
    lifeControl,
    cardCommands,
    counterCommands,
    targetCommands,
    zoneCommands,
    prompts: { openAnnotationPrompt, openPTPrompt, openCardCounterPrompt, openMoveXFromTopPrompt, openTokenCountPrompt },
    setLastToken,
    startAttach,
    startArrow: startTableArrow,
  });
  const handOps = useHandCardOps({ cards: zones.hand.cards, selection, cardMetaByName, zoneCommands });
  // Displayed counts mirror Cockatrice desktop: read straight from the
  // server-authoritative `zone.cardCount` and DON'T decrement while a
  // card is under the cursor mid-drag. The desktop client also shows
  // the same pre-drop count until the server broadcasts the move back;
  // the visible "card in flight" is the drag ghost, not a badge tweak.
  // Zero before the player hydrates.
  const displayedDeckCount = zones.library.cardCount ?? 0;
  const displayedGraveyardCount = zones.graveyard.cardCount ?? 0;
  const displayedExileCount = zones.exile.cardCount ?? 0;

  const graveDisplayList = zones.graveyard.cards;
  const exileDisplayList = zones.exile.cards;
  const handDisplayList = zones.hand.cards;
  const handCount = zones.hand.cardCount ?? handDisplayList.length;
  const stackDisplayList = zones.stack.cards;

  const startMoveTopUntil = useMoveTopUntil({
    enabled: isSelf,
    stackCards: stackDisplayList,
    deckCount,
    describeCard,
    moveCards: zoneCommands.moveCards,
  });
  const openMoveTopUntilDialog = () => openMoveTopUntil({ onSubmit: startMoveTopUntil });

  const {
    graveMenuItemsSelf,
    graveMenuItemsOpponent,
    exileMenuItemsSelf,
    exileMenuItemsOpponent,
  } = usePileMenus({
    seatId,
    revealTargets,
    graveDisplayList,
    exileDisplayList,
    displayedGraveyardCount,
    displayedExileCount,
    menuShortcut,
    zoneCommands,
  });
  const libraryOps = useLibraryOps({ deckCount, openCountPrompt, zoneCommands });
  const {
    libraryMenuItems,
    topLibraryItems,
    bottomLibraryItems,
  } = useLibraryMenuItems({
    seatId,
    deckCount,
    revealTargets,
    alwaysRevealTopCard,
    alwaysLookAtTopCard,
    draw,
    libraryOps,
    openDrawCardsPrompt,
    openViewLibraryCountPrompt,
    openRevealTopCardsPrompt,
    openMoveTopUntilDialog,
    onOpenDeckInEditor,
    menuShortcut,
    zoneCommands,
  });
  const {
    handSize,
    handMenuItems,
    sortHandItems,
    revealHandItems,
  } = useHandMenuItems({ seatId, isSelf, hand: zones.hand, revealTargets, menuShortcut, zoneCommands });
  const {
    battlefieldMenuItems,
    opponentBattlefieldMenuItems,
  } = useBattlefieldMenuItems({
    seatId,
    customZones: zones.customZones ?? [],
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
    incrementAllCardCounters: cardOps.incrementAllCounters,
    battlefieldDisplayList,
    lastToken,
    openCreateTokenDialog,
    menuShortcut,
    cardCommands,
    counterCommands,
  });
  useSeatShortcutOperations({
    seatId,
    isSelf,
    selection,
    selectedCardKeys: gameSelection?.selectedCardKeys ?? EMPTY_CARD_KEYS,
    deckCount,
    handCount,
    alwaysRevealTopCard,
    alwaysLookAtTopCard,
    manaCounters,
    lifeControl,
    lastToken,
    openLifePrompt,
    openCounterPrompt,
    openViewLibraryCountPrompt,
    openCreateTokenDialog,
    openMoveTopUntilDialog,
    cardOps,
    handOps,
    libraryOps,
    zoneCommands,
    cardCommands,
    counterCommands,
    targetCommands,
  });

  const { onCardClick, onCardDoubleClick, onCardActivate } = useSeatClickToPlay({
    canAct: model.permissions.canAct,
    selection,
    handDisplayList,
    stackDisplayList,
    battlefieldDisplayList,
    cardMetaByName,
    setCardMetaByName,
    zoneCommands,
    cardCommands,
  });

  const activateCard = (
    zone: SeatSelectionZone,
    card: PlayerCardViewModel & { ownerPlayerId?: number },
    element: HTMLElement,
  ) => {
    if (pickArrowAt(element)) {
      return;
    }
    if (attachPicking) {
      if (zone === 'battlefield') {
        pickAttachTarget(battlefieldTarget(card));
      }
      return;
    }
    onCardActivate(zone, card);
  };
  const openCardMenuAt = (zone: SeatSelectionZone, card: { id: string }, rect: DOMRect) =>
    openSeatCardMenu({ kind: zone, playerId: menuOwnerId, cardId: card.id, x: rect.left, y: rect.bottom });

  const {
    startPileDrag,
    isDragging,
    startSeatCardDrag,
    keyboardMoveSource,
    stackZoneRef,
    handZoneRef,
    libraryZoneRef,
    graveyardZoneRef,
    exileZoneRef,
  } = useSeatDnd({
    seatId,
    seatDrag,
    selection,
    setSelection,
    resolveAttachPress,
    printedPT: (cardName) => cardMetaByName.get(cardName)?.pt,
    stackDisplayList,
    handDisplayList,
    horizontalHand,
    handRef,
    stackRef,
    libraryRef,
    graveyardRef,
    exileRef,
    onCardClick,
    CARD_W_PX,
    CARD_H_PX,
    stackPileOptions,
  });

  const requestKeyboardMove = useKeyboardMove();
  const moveWithKeyboard = (zone: SeatSelectionZone, card: PlayerCardViewModel & { ownerPlayerId?: number }) => {
    const zoneCards = zone === 'battlefield' ? battlefieldDisplayList : zone === 'hand' ? handDisplayList : stackDisplayList;
    const source = keyboardMoveSource(card, zone, zoneCards);
    if (source && requestKeyboardMove) {
      requestKeyboardMove({ source, name: card.name });
    }
  };

  return {
    moveWithKeyboard,
    CARD_H_PX,
    CARD_W_PX,
    DRAW_ANIMATION_MS,
    alwaysLookAtTopCard,
    alwaysRevealTopCard,
    attachExtraSourceIds,
    activateCard,
    attachPending,
    attachPicking,
    battlefieldDisplayList,
    battlefieldMenuItems,
    bottomLibraryItems,
    boxRef,
    cardCommands,
    cardContextMenu,
    cardMetaByName,
    cardOps,
    closeSeatCardMenu,
    counterCommands,
    deck: deckCards,
    deckCount,
    deckTopCard,
    displayedDeckCount,
    displayedExileCount,
    displayedGraveyardCount,
    draw,
    exileDisplayList,
    exileMenuItemsOpponent,
    exileMenuItemsSelf,
    exileZoneRef,
    flights,
    flipHandCardBacks,
    gameSelection,
    graveDisplayList,
    graveMenuItemsOpponent,
    graveMenuItemsSelf,
    graveyardZoneRef,
    handCardMenu,
    handCount,
    handDisplayList,
    handMenuItems,
    handOnTop,
    handPileOptions,
    handPlacement,
    handRef,
    handSize,
    handZoneRef,
    horizontalHand,
    isActive,
    isDragging,
    isSelf,
    libraryMenuItems,
    libraryZoneRef,
    life,
    lifeControl,
    manaCounters,
    marquee,
    menuOwnerId,
    name,
    onCardDoubleClick,
    onOpenDeckInEditor,
    onPointerDownBox,
    openAnnotationPrompt,
    openCardCounterPrompt,
    openCardMenuAt,
    openCountPrompt,
    openCreateTokenDialog,
    openDrawCardsPrompt,
    openLifePrompt,
    openMoveTopUntilDialog,
    openMoveXFromTopPrompt,
    openPTPrompt,
    openRevealTopCardsPrompt,
    openSeatCardMenu,
    openViewLibraryCountPrompt,
    openZoneView,
    opponentBattlefieldMenuItems,
    pileCardMenu,
    playerId,
    relatedViewItemsFor,
    resolveFaceImageUri,
    revealHandItems,
    revealTargets,
    seat,
    seatDrag,
    seatGrid,
    seatId,
    seatPending,
    selection,
    setCardMetaByName,
    setLife,
    setSelection,
    menuShortcut,
    sortHandItems,
    stackCardMenu,
    stackDisplayList,
    stackPileOptions,
    stackZoneRef,
    startAttach,
    startDrawArrow,
    startPileDrag,
    startSeatCardDrag,
    targetCommands,
    tokenMetaByName,
    topLibraryItems,
    zoneCommands,
    zoneViewCardMenu,
    zones,
  };
}

export type PlayerSeat = ReturnType<typeof usePlayerSeat>;
