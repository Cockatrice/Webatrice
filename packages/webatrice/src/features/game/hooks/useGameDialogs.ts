import { useCallback, useState } from 'react';

import { useSettings } from '@app/hooks';
import { useAppDispatch } from '@app/store';
import { useWebClient } from '@cockatrice/datatrice/react';
import { CardAttribute, ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched, GameEntry, PlayerEntry, games } from '@cockatrice/datatrice';
import { CardDTO } from '../../../services/dexie/DexieDTOs/CardDTO';
import { COUNTER_TYPE_LABELS } from '../components/ui/CardSlot/counterColors';
import { DEFAULT_DIE_COUNT, DEFAULT_DIE_SIDES } from '../dialogs/RollDieDialog/RollDieDialog';
import type { SideboardPlanMove } from '../dialogs/SideboardDialog/SideboardDialog';
import type { GameAccess } from './useGameAccess';
import { playCardViaTableRow } from './playCard';
import { useJudgeTarget } from './useJudgeTarget';

export interface AnchorPosition {
  top: number;
  left: number;
}

export interface ZoneViewTarget {
  playerId: number;
  zoneName: string;
}

export interface CardMenuState {
  card: ServerInfo_Card;
  sourcePlayerId: number;
  sourceZone: string;
  anchorPosition: AnchorPosition;
}

export interface ZoneMenuState {
  playerId: number;
  zoneName: string;
  anchorPosition: AnchorPosition;
}

export interface PromptState {
  title: string;
  label: string;
  initialValue?: string;
  helperText?: string;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

export interface RevealState {
  title: string;
  zoneName: string;
  zoneLabel: string;
  showCountInput: boolean;
  defaultCount: number;
  onSubmit: (args: { targetPlayerId: number; topCards: number }) => void;
}

export type ConcedeConfirm = 'concede' | 'unconcede' | null;

export interface StartPendingSource {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
}

export interface GameDialogs {
  // Card/zone/player/hand menus
  cardMenu: CardMenuState | null;
  zoneMenu: ZoneMenuState | null;
  playerMenu: AnchorPosition | null;
  handMenu: AnchorPosition | null;
  closeCardMenu: () => void;
  closeZoneMenu: () => void;
  closePlayerMenu: () => void;
  closeHandMenu: () => void;
  handleCardContextMenu: (
    sourcePlayerId: number | undefined,
    sourceZone: string | undefined,
    card: ServerInfo_Card,
    event: React.MouseEvent,
  ) => void;
  handleZoneContextMenu: (
    playerId: number,
    zoneName: string,
    event: React.MouseEvent,
  ) => void;
  handlePlayerContextMenu: (event: React.MouseEvent) => void;
  handleHandContextMenu: (event: React.MouseEvent) => void;

  // Zone-view dialog stack
  zoneViews: ZoneViewTarget[];
  handleZoneClick: (playerId: number, zoneName: string) => void;
  handleCloseZoneView: (playerId: number, zoneName: string, shuffleOnClose?: boolean) => void;

  // Prompt dialog
  prompt: PromptState | null;
  closePrompt: () => void;

  // Roll die dialog
  rollDieOpen: boolean;
  lastDieSides: number;
  lastDieCount: number;
  openRollDie: () => void;
  closeRollDie: () => void;
  handleRollDieSubmit: (args: { sides: number; count: number }) => void;

  // Token / sideboard / game info / concede
  createTokenOpen: boolean;
  openCreateToken: () => void;
  closeCreateToken: () => void;
  handleCreateTokenSubmit: (args: {
    name: string;
    color: string;
    pt: string;
    annotation: string;
    destroyOnZoneChange: boolean;
    faceDown: boolean;
    providerId?: string;
  }) => void;

  sideboardOpen: boolean;
  openSideboard: () => void;
  closeSideboard: () => void;
  handleSideboardSubmit: (moveList: SideboardPlanMove[]) => void;
  handleToggleSideboardLock: (locked: boolean) => void;

  gameInfoOpen: boolean;
  openGameInfo: () => void;
  closeGameInfo: () => void;

  concedeConfirm: ConcedeConfirm;
  openConcede: () => void;
  openUnconcede: () => void;
  closeConcedeConfirm: () => void;
  confirmConcede: () => void;
  confirmUnconcede: () => void;

  // Reveal-cards dialog
  revealState: RevealState | null;
  closeReveal: () => void;

  // Card context menu action handlers
  handleRequestSetPT: () => void;
  handleRequestSetAnnotation: () => void;
  handleRequestSetCardCounter: (counterId: number) => void;
  handleRequestDrawArrow: () => void;
  handleRequestAttach: () => void;
  handleRequestPlayFromCardMenu: (faceDown: boolean) => void;
  handleRequestMoveToLibraryAt: () => void;

  // Zone context menu action handlers
  handleRequestDrawN: () => void;
  handleRequestDumpN: () => void;
  handleRequestRevealTopN: () => void;
  handleRequestRevealZone: () => void;

  // Library extended actions
  handleRequestUndoDraw: () => void;
  handleRequestDrawBottom: () => void;
  handleRequestMoveTopCardToZone: (zone: string, options?: { x?: number }) => void;
  handleRequestPlayTop: (faceDown: boolean) => void;
  handleRequestMoveTopNToZone: (zone: string) => void;
  handleRequestShuffleTopN: () => void;
  handleRequestShuffleBottomN: () => void;

  // View the current zoneMenu's zone (deck / grave / exile) — reuses the
  // existing zone-view dialog stack.
  handleRequestViewZone: () => void;

  // Graveyard / Exile actions (sourceZone resolved from current zoneMenu)
  handleRequestMoveAllFromZoneToDeck: (top: boolean) => void;
  handleRequestMoveAllFromZoneTo: (targetZone: string) => void;
  handleRequestRevealRandomFromZone: () => void;

  // Hand context menu action handlers
  handleRequestChooseMulligan: () => void;
  handleRequestRevealHand: () => void;
  handleRequestRevealRandom: () => void;
  handleRequestViewHand: () => void;
  handleRequestSortHandBy: (key: HandSortKey) => void;
  handleRequestMoveHandToDeck: (top: boolean) => void;
  handleRequestMoveHandToZone: (zone: string) => void;
}

export type HandSortKey = 'name' | 'maintype' | 'manacost';

export interface UseGameDialogsArgs {
  gameId: number | undefined;
  game: GameEntry | undefined;
  localPlayer: PlayerEntry | undefined;
  localAccess: GameAccess;
  isSpectator: boolean;
  startPendingArrow: (source: StartPendingSource) => void;
  startPendingAttach: (source: StartPendingSource) => void;
  // Applies the collapse-unless-selected rule before opening the card menu, so a
  // right-click on an unselected card collapses to it while a right-click on a
  // selected card preserves the multi-selection for bulk actions.
  collapseUnlessSelected: (
    ownerPlayerId: number | undefined,
    zone: string | undefined,
    card: ServerInfo_Card,
  ) => void;
}

export function useGameDialogs({
  gameId,
  game,
  localPlayer,
  localAccess,
  isSpectator,
  startPendingArrow,
  startPendingAttach,
  collapseUnlessSelected,
}: UseGameDialogsArgs): GameDialogs {
  const webClient = useWebClient();
  const dispatch = useAppDispatch();
  const judgeTarget = useJudgeTarget(gameId);
  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;

  const [zoneViews, setZoneViews] = useState<ZoneViewTarget[]>([]);
  const [cardMenu, setCardMenu] = useState<CardMenuState | null>(null);
  const [zoneMenu, setZoneMenu] = useState<ZoneMenuState | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [rollDieOpen, setRollDieOpen] = useState(false);
  const [lastDieSides, setLastDieSides] = useState(DEFAULT_DIE_SIDES);
  const [lastDieCount, setLastDieCount] = useState(DEFAULT_DIE_COUNT);
  const [createTokenOpen, setCreateTokenOpen] = useState(false);
  const [sideboardOpen, setSideboardOpen] = useState(false);
  const [revealState, setRevealState] = useState<RevealState | null>(null);
  const [playerMenu, setPlayerMenu] = useState<AnchorPosition | null>(null);
  const [handMenu, setHandMenu] = useState<AnchorPosition | null>(null);
  const [concedeConfirm, setConcedeConfirm] = useState<ConcedeConfirm>(null);
  const [gameInfoOpen, setGameInfoOpen] = useState(false);

  const handleZoneClick = useCallback((playerId: number, zoneName: string) => {
    const alreadyOpen = zoneViews.some((v) => v.playerId === playerId && v.zoneName === zoneName);
    setZoneViews((prev) =>
      alreadyOpen ? prev : [...prev, { playerId, zoneName }],
    );
    // Reveal the deck's hidden cards: dump the local player's library and let the
    // Response_DumpZone card list flow into the store (read back via getRevealedCards).
    // Re-opening an already-open view is a no-op (don't re-dump), matching desktop.
    if (
      !alreadyOpen &&
      gameId != null &&
      playerId === game?.localPlayerId &&
      zoneName === Enriched.ZoneName.DECK
    ) {
      webClient.request.game.dumpZone(gameId, { playerId, zoneName, numberCards: -1, isReversed: false });
    }
  }, [zoneViews, gameId, game, webClient]);

  const handleCloseZoneView = useCallback((playerId: number, zoneName: string, shuffleOnClose?: boolean) => {
    setZoneViews((prev) =>
      prev.filter((v) => !(v.playerId === playerId && v.zoneName === zoneName)),
    );
    // Closing a deck view shuffles the library (desktop "shuffle on close") and discards the
    // revealed snapshot so a later view re-dumps fresh.
    if (gameId != null && playerId === game?.localPlayerId && zoneName === Enriched.ZoneName.DECK) {
      if (shuffleOnClose) {
        webClient.request.game.shuffle(gameId, { zoneName, start: 0, end: -1 });
      }
      dispatch(games.Actions.zoneViewCleared({ gameId, playerId, zoneName }));
    }
  }, [gameId, game, webClient, dispatch]);

  // Mutual exclusion: only one in-game context menu is open at a time.
  // Each `handle*ContextMenu` calls this before opening its own menu so the
  // four menu states stay invariantly disjoint.
  const closeAllContextMenus = useCallback(() => {
    setCardMenu(null);
    setZoneMenu(null);
    setPlayerMenu(null);
    setHandMenu(null);
  }, []);

  const handleCardContextMenu = useCallback(
    (
      sourcePlayerId: number | undefined,
      sourceZone: string | undefined,
      card: ServerInfo_Card,
      event: React.MouseEvent,
    ) => {
      if (sourcePlayerId == null || sourceZone == null) {
        return;
      }
      event.preventDefault();
      // Collapse to this card unless it's already part of the selection.
      collapseUnlessSelected(sourcePlayerId, sourceZone, card);
      closeAllContextMenus();
      setCardMenu({
        card,
        sourcePlayerId,
        sourceZone,
        anchorPosition: { top: event.clientY, left: event.clientX },
      });
    },
    [closeAllContextMenus, collapseUnlessSelected],
  );

  const handleZoneContextMenu = useCallback(
    (playerId: number, zoneName: string, event: React.MouseEvent) => {
      if (playerId !== game?.localPlayerId) {
        return;
      }
      const supported =
        zoneName === Enriched.ZoneName.DECK ||
        zoneName === Enriched.ZoneName.GRAVE ||
        zoneName === Enriched.ZoneName.EXILE;
      if (!supported) {
        return;
      }
      event.preventDefault();
      closeAllContextMenus();
      setZoneMenu({
        playerId,
        zoneName,
        anchorPosition: { top: event.clientY, left: event.clientX },
      });
    },
    [game?.localPlayerId, closeAllContextMenus],
  );

  const handlePlayerContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (gameId == null || isSpectator || localAccess.canAct === false) {
        return;
      }
      event.preventDefault();
      closeAllContextMenus();
      setPlayerMenu({ top: event.clientY, left: event.clientX });
    },
    [gameId, isSpectator, localAccess.canAct, closeAllContextMenus],
  );

  const handleHandContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (gameId == null || isSpectator || localAccess.canAct === false) {
        return;
      }
      event.preventDefault();
      closeAllContextMenus();
      setHandMenu({ top: event.clientY, left: event.clientX });
    },
    [gameId, isSpectator, localAccess.canAct, closeAllContextMenus],
  );

  const handleRequestSetPT = useCallback(() => {
    const menu = cardMenu;
    if (!menu || gameId == null) {
      return;
    }
    setPrompt({
      title: 'Set power/toughness',
      label: 'P/T (e.g. 3/3)',
      initialValue: menu.card.pt ?? '',
      onSubmit: (value) => {
        webClient.request.game.setCardAttr(gameId, {
          zone: menu.sourceZone,
          cardId: menu.card.id,
          attribute: CardAttribute.AttrPT,
          attrValue: value,
        }, judgeTarget(menu.sourcePlayerId));
        setPrompt(null);
      },
    });
  }, [cardMenu, judgeTarget, gameId, webClient]);

  const handleRequestSetAnnotation = useCallback(() => {
    const menu = cardMenu;
    if (!menu || gameId == null) {
      return;
    }
    setPrompt({
      title: 'Set annotation',
      label: 'Annotation',
      initialValue: menu.card.annotation ?? '',
      onSubmit: (value) => {
        webClient.request.game.setCardAttr(gameId, {
          zone: menu.sourceZone,
          cardId: menu.card.id,
          attribute: CardAttribute.AttrAnnotation,
          attrValue: value,
        }, judgeTarget(menu.sourcePlayerId));
        setPrompt(null);
      },
    });
  }, [cardMenu, judgeTarget, gameId, webClient]);

  const handleRequestSetCardCounter = useCallback((counterId: number) => {
    const menu = cardMenu;
    if (!menu || gameId == null) {
      return;
    }
    const existing = menu.card.counterList.find((c) => c.id === counterId);
    const label = COUNTER_TYPE_LABELS[counterId] ?? String(counterId);
    setPrompt({
      title: `Set ${label} counter`,
      label: 'Counter value',
      initialValue: String(existing?.value ?? 0),
      validate: (v) => (/^-?\d+$/.test(v) ? null : 'Enter an integer'),
      onSubmit: (value) => {
        webClient.request.game.setCardCounter(gameId, {
          zone: menu.sourceZone,
          cardId: menu.card.id,
          counterId,
          counterValue: Number(value),
        }, judgeTarget(menu.sourcePlayerId));
        setPrompt(null);
      },
    });
  }, [cardMenu, judgeTarget, gameId, webClient]);

  const handleRequestDrawArrow = useCallback(() => {
    const menu = cardMenu;
    if (!menu) {
      return;
    }
    startPendingArrow({
      sourcePlayerId: menu.sourcePlayerId,
      sourceZone: menu.sourceZone,
      sourceCardId: menu.card.id,
    });
  }, [cardMenu, startPendingArrow]);

  const handleRequestAttach = useCallback(() => {
    const menu = cardMenu;
    if (!menu) {
      return;
    }
    startPendingAttach({
      sourcePlayerId: menu.sourcePlayerId,
      sourceZone: menu.sourceZone,
      sourceCardId: menu.card.id,
    });
  }, [cardMenu, startPendingAttach]);

  // Play-from-card-menu via tablerow logic (boundaries prevent inlining in CardContextMenu).
  const handleRequestPlayFromCardMenu = useCallback(
    (faceDown: boolean) => {
      const menu = cardMenu;
      if (!menu || gameId == null || game == null) {
        return;
      }
      // A judge playing a foreign card wraps as the owner and lands it on the
      // owner's table; own cards send bare (judgeTarget → undefined). See useJudgeTarget.
      void playCardViaTableRow({
        webClient,
        gameId,
        sourcePlayerId: menu.sourcePlayerId,
        sourceZone: menu.sourceZone,
        card: menu.card,
        faceDown,
        isInverted: invertVerticalCoordinate,
        tableZone: game.players[menu.sourcePlayerId]?.zones[Enriched.ZoneName.TABLE],
        judgeTargetId: judgeTarget(menu.sourcePlayerId),
      });
    },
    [cardMenu, game, gameId, invertVerticalCoordinate, judgeTarget, webClient],
  );

  const handleRequestMoveToLibraryAt = useCallback(() => {
    const menu = cardMenu;
    if (!menu || gameId == null || game == null) {
      return;
    }
    // 1-indexed prompt → 0-indexed wire. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
    setPrompt({
      title: 'Move to library at position',
      label: 'Position (1 = top)',
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
      onSubmit: (value) => {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: menu.sourcePlayerId,
          startZone: menu.sourceZone,
          cardsToMove: { card: [{ cardId: menu.card.id }] },
          targetPlayerId: game.localPlayerId,
          targetZone: Enriched.ZoneName.DECK,
          x: Math.max(0, Number(value) - 1),
          y: 0,
          isReversed: false,
        });
        setPrompt(null);
      },
    });
  }, [cardMenu, game, gameId, webClient]);

  const handleRequestDrawN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setPrompt({
      title: 'Draw N cards',
      label: 'Number of cards',
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
      onSubmit: (value) => {
        webClient.request.game.drawCards(gameId, { number: Number(value) });
        setPrompt(null);
      },
    });
  }, [gameId, webClient]);

  const handleRequestDumpN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setPrompt({
      title: 'Dump top N',
      label: 'Number of cards',
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
      onSubmit: (value) => {
        webClient.request.game.dumpZone(gameId, {
          playerId: game!.localPlayerId,
          zoneName: Enriched.ZoneName.DECK,
          numberCards: Number(value),
          isReversed: false,
        });
        setPrompt(null);
      },
    });
  }, [game, gameId, webClient]);

  const handleRollDieSubmit = useCallback(
    ({ sides, count }: { sides: number; count: number }) => {
      if (gameId == null) {
        return;
      }
      webClient.request.game.rollDie(gameId, { sides, count });
      setLastDieSides(sides);
      setLastDieCount(count);
      setRollDieOpen(false);
    },
    [gameId, webClient],
  );

  const handleCreateTokenSubmit = useCallback(
    (args: {
      name: string;
      color: string;
      pt: string;
      annotation: string;
      destroyOnZoneChange: boolean;
      faceDown: boolean;
      providerId?: string;
    }) => {
      if (gameId == null) {
        return;
      }
      webClient.request.game.createToken(gameId, {
        zone: Enriched.ZoneName.TABLE,
        cardName: args.name,
        color: args.color,
        pt: args.pt,
        annotation: args.annotation,
        destroyOnZoneChange: args.destroyOnZoneChange,
        x: 0,
        y: 0,
        faceDown: args.faceDown,
        targetCardId: -1,
        cardProviderId: args.providerId ?? '',
      });
      setCreateTokenOpen(false);
    },
    [gameId, webClient],
  );

  const handleSideboardSubmit = useCallback(
    (moveList: SideboardPlanMove[]) => {
      if (gameId == null) {
        return;
      }
      webClient.request.game.setSideboardPlan(gameId, { moveList });
      setSideboardOpen(false);
    },
    [gameId, webClient],
  );

  const handleToggleSideboardLock = useCallback(
    (locked: boolean) => {
      if (gameId == null) {
        return;
      }
      webClient.request.game.setSideboardLock(gameId, { locked });
    },
    [gameId, webClient],
  );

  const handleRequestChooseMulligan = useCallback(() => {
    if (gameId == null) {
      return;
    }
    // Mulligan accepts [-handSize, handSize + deckSize]; ≤0 is relative-to-hand-size (desktop parity).
    const handSize = localPlayer?.zones[Enriched.ZoneName.HAND]?.cardCount ?? 0;
    const deckSize = localPlayer?.zones[Enriched.ZoneName.DECK]?.cardCount ?? 0;
    const min = -handSize;
    const max = handSize + deckSize;
    setPrompt({
      title: 'Take mulligan',
      label: 'New hand size',
      initialValue: '7',
      helperText: '0 and lower are in comparison to current hand size.',
      validate: (v) => {
        if (!/^-?\d+$/.test(v)) {
          return 'Enter an integer.';
        }
        const n = Number(v);
        if (n < min || n > max) {
          return `Enter an integer between ${min} and ${max}.`;
        }
        return null;
      },
      onSubmit: (value) => {
        const input = Number(value);
        const resolved = input < 1 ? handSize + input : input;
        webClient.request.game.mulligan(gameId, { number: resolved });
        setPrompt(null);
      },
    });
  }, [gameId, localPlayer, webClient]);

  const handleRequestRevealHand = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setRevealState({
      title: 'Reveal hand',
      zoneName: Enriched.ZoneName.HAND,
      zoneLabel: 'Hand',
      showCountInput: false,
      defaultCount: 1,
      onSubmit: ({ targetPlayerId }) => {
        webClient.request.game.revealCards(gameId, {
          zoneName: Enriched.ZoneName.HAND,
          playerId: targetPlayerId,
          topCards: -1,
        });
        setRevealState(null);
      },
    });
  }, [gameId, webClient]);

  // Reuse zone-view dialog for aViewHand parity.
  const handleRequestViewHand = useCallback(() => {
    if (game?.localPlayerId == null) {
      return;
    }
    handleZoneClick(game.localPlayerId, Enriched.ZoneName.HAND);
  }, [game?.localPlayerId, handleZoneClick]);

  // Sort-hand: per-card moveCard dispatches (desktop hand_menu.cpp parity); async for Dexie metadata lookups.
  const handleRequestSortHandBy = useCallback(
    (key: HandSortKey) => {
      if (gameId == null || game == null || localPlayer == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const handZone = localPlayer.zones[Enriched.ZoneName.HAND];
      if (!handZone) {
        return;
      }
      const cards = handZone.order.map((id) => handZone.byId[id]).filter(Boolean);
      void (async () => {
        const lookups = await Promise.all(
          cards.map(async (card) => {
            const meta = await CardDTO.get(card.name).catch(() => undefined);
            const maintype = meta?.prop?.value?.maintype?.value ?? '';
            const manacost = meta?.prop?.value?.manacost?.value ?? '';
            // CMC approximated from mana-symbol string; needs to be monotonic, not exact.
            const cmc = (() => {
              if (!manacost) {
                return 0;
              }
              const groups = manacost.match(/\{[^}]+\}/g) ?? [];
              let total = 0;
              for (const g of groups) {
                const inner = g.slice(1, -1);
                const n = Number(inner);
                total += Number.isFinite(n) ? n : 1;
              }
              return total;
            })();
            return { card, name: card.name ?? '', maintype, cmc };
          }),
        );
        const sorted = lookups.slice().sort((a, b) => {
          if (key === 'name') {
            return a.name.localeCompare(b.name);
          }
          if (key === 'maintype') {
            const t = a.maintype.localeCompare(b.maintype);
            return t !== 0 ? t : a.name.localeCompare(b.name);
          }
          // manacost
          const c = a.cmc - b.cmc;
          return c !== 0 ? c : a.name.localeCompare(b.name);
        });
        // Reverse dispatch so the first sorted card ends up at index 0.
        for (let i = sorted.length - 1; i >= 0; i--) {
          const entry = sorted[i];
          webClient.request.game.moveCard(gameId, {
            startPlayerId: localPlayerId,
            startZone: Enriched.ZoneName.HAND,
            cardsToMove: { card: [{ cardId: entry.card.id }] },
            targetPlayerId: localPlayerId,
            targetZone: Enriched.ZoneName.HAND,
            x: 0,
            y: 0,
            isReversed: false,
          });
        }
      })();
    },
    [game, gameId, localPlayer, webClient],
  );

  // Move hand → deck: per-card moveCard, x=0 (top) or x=-1 (bottom).
  const handleRequestMoveHandToDeck = useCallback(
    (top: boolean) => {
      if (gameId == null || localPlayer == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const handZone = localPlayer.zones[Enriched.ZoneName.HAND];
      if (!handZone) {
        return;
      }
      for (const cardId of handZone.order) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: localPlayerId,
          startZone: Enriched.ZoneName.HAND,
          cardsToMove: { card: [{ cardId }] },
          targetPlayerId: localPlayerId,
          targetZone: Enriched.ZoneName.DECK,
          x: top ? 0 : -1,
          y: 0,
          isReversed: false,
        });
      }
    },
    [game?.localPlayerId, gameId, localPlayer, webClient],
  );

  const handleRequestMoveHandToZone = useCallback(
    (targetZone: string) => {
      if (gameId == null || localPlayer == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const handZone = localPlayer.zones[Enriched.ZoneName.HAND];
      if (!handZone) {
        return;
      }
      for (const cardId of handZone.order) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: localPlayerId,
          startZone: Enriched.ZoneName.HAND,
          cardsToMove: { card: [{ cardId }] },
          targetPlayerId: localPlayerId,
          targetZone,
          x: 0,
          y: 0,
          isReversed: false,
        });
      }
    },
    [game?.localPlayerId, gameId, localPlayer, webClient],
  );

  const handleRequestRevealRandom = useCallback(() => {
    if (gameId == null) {
      return;
    }
    // RANDOM_CARD_FROM_ZONE = -2. See .github/instructions/webatrice-game.instructions.md#dialog-parity.
    const RANDOM_CARD_FROM_ZONE = -2;
    setRevealState({
      title: 'Reveal random card',
      zoneName: Enriched.ZoneName.HAND,
      zoneLabel: 'Hand (random)',
      showCountInput: false,
      defaultCount: 1,
      onSubmit: ({ targetPlayerId }) => {
        webClient.request.game.revealCards(gameId, {
          zoneName: Enriched.ZoneName.HAND,
          cardId: [RANDOM_CARD_FROM_ZONE],
          playerId: targetPlayerId,
          topCards: -1,
        });
        setRevealState(null);
      },
    });
  }, [gameId, webClient]);

  const handleRequestRevealTopN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setRevealState({
      title: 'Reveal top N cards',
      zoneName: Enriched.ZoneName.DECK,
      zoneLabel: 'Library',
      showCountInput: true,
      defaultCount: 1,
      onSubmit: ({ targetPlayerId, topCards }) => {
        webClient.request.game.revealCards(gameId, {
          zoneName: Enriched.ZoneName.DECK,
          playerId: targetPlayerId,
          topCards,
        });
        setRevealState(null);
      },
    });
  }, [gameId, webClient]);

  const handleRequestRevealZone = useCallback(() => {
    if (gameId == null || zoneMenu == null) {
      return;
    }
    const { zoneName } = zoneMenu;
    const label =
      zoneName === Enriched.ZoneName.GRAVE ? 'Graveyard' :
        zoneName === Enriched.ZoneName.EXILE ? 'Exile' : zoneName;
    setRevealState({
      title: `Reveal ${label.toLowerCase()}`,
      zoneName,
      zoneLabel: label,
      showCountInput: false,
      defaultCount: 1,
      onSubmit: ({ targetPlayerId }) => {
        webClient.request.game.revealCards(gameId, {
          zoneName,
          playerId: targetPlayerId,
          topCards: -1,
        });
        setRevealState(null);
      },
    });
  }, [gameId, zoneMenu, webClient]);

  // ---------------------------------------------------------------------
  // Library / Graveyard / Exile extended actions.

  const handleRequestUndoDraw = useCallback(() => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.undoDraw(gameId);
  }, [gameId, webClient]);

  // Hidden-zone command addressing is positional. See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.

  const handleRequestDrawBottom = useCallback(() => {
    if (gameId == null || game?.localPlayerId == null) {
      return;
    }
    const localPlayerId = game.localPlayerId;
    const deck = game.players[localPlayerId]?.zones[Enriched.ZoneName.DECK];
    const cardCount = deck?.cardCount ?? 0;
    if (cardCount === 0) {
      return;
    }
    // Draw bottom: card_id = size-1.
    webClient.request.game.moveCard(gameId, {
      startPlayerId: localPlayerId,
      startZone: Enriched.ZoneName.DECK,
      cardsToMove: { card: [{ cardId: cardCount - 1 }] },
      targetPlayerId: localPlayerId,
      targetZone: Enriched.ZoneName.HAND,
      x: 0,
      y: 0,
      isReversed: false,
    });
  }, [game, gameId, webClient]);

  const handleRequestMoveTopCardToZone = useCallback(
    (targetZone: string, options?: { x?: number }) => {
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const deck = game.players[localPlayerId]?.zones[Enriched.ZoneName.DECK];
      if ((deck?.cardCount ?? 0) === 0) {
        return;
      }
      // card_id = 0 for top.
      webClient.request.game.moveCard(gameId, {
        startPlayerId: localPlayerId,
        startZone: Enriched.ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 0 }] },
        targetPlayerId: localPlayerId,
        targetZone,
        x: options?.x ?? 0,
        y: 0,
        isReversed: false,
      });
    },
    [game, gameId, webClient],
  );

  const handleRequestPlayTop = useCallback(
    (faceDown: boolean) => {
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const deck = game.players[localPlayerId]?.zones[Enriched.ZoneName.DECK];
      if ((deck?.cardCount ?? 0) === 0) {
        return;
      }
      // Play-from-top deliberately ignores tablerow. See .github/instructions/webatrice-game.instructions.md#servatrice-game-event-quirks.
      webClient.request.game.moveCard(gameId, {
        startPlayerId: localPlayerId,
        startZone: Enriched.ZoneName.DECK,
        cardsToMove: { card: [{ cardId: 0, faceDown }] },
        targetPlayerId: localPlayerId,
        targetZone: faceDown ? Enriched.ZoneName.TABLE : Enriched.ZoneName.STACK,
        x: -1,
        y: 0,
        isReversed: false,
      });
    },
    [game, gameId, webClient],
  );

  const handleRequestMoveTopNToZone = useCallback(
    (targetZone: string) => {
      if (gameId == null || game?.localPlayerId == null) {
        return;
      }
      const localPlayerId = game.localPlayerId;
      const zoneLabel =
        targetZone === Enriched.ZoneName.GRAVE ? 'graveyard'
          : targetZone === Enriched.ZoneName.EXILE ? 'exile' : targetZone;
      setPrompt({
        title: `Move top N cards to ${zoneLabel}`,
        label: 'Number of cards',
        initialValue: '1',
        validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
        onSubmit: (value) => {
          const requested = Number(value);
          const deck = game.players[localPlayerId]?.zones[Enriched.ZoneName.DECK];
          const cardCount = deck?.cardCount ?? 0;
          if (cardCount === 0) {
            setPrompt(null);
            return;
          }
          const n = Math.min(requested, cardCount);
          // Positional indices [n-1, ..., 0]; server resolves against deck ordering.
          const cards: { cardId: number }[] = [];
          for (let i = n - 1; i >= 0; i--) {
            cards.push({ cardId: i });
          }
          webClient.request.game.moveCard(gameId, {
            startPlayerId: localPlayerId,
            startZone: Enriched.ZoneName.DECK,
            cardsToMove: { card: cards },
            targetPlayerId: localPlayerId,
            targetZone,
            x: 0,
            y: 0,
            isReversed: false,
          });
          setPrompt(null);
        },
      });
    },
    [game, gameId, webClient],
  );

  const handleRequestShuffleTopN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setPrompt({
      title: 'Shuffle top N cards',
      label: 'Number of cards',
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
      onSubmit: (value) => {
        const n = Number(value);
        webClient.request.game.shuffle(gameId, {
          zoneName: Enriched.ZoneName.DECK,
          start: 0,
          end: n - 1,
        });
        setPrompt(null);
      },
    });
  }, [gameId, webClient]);

  const handleRequestShuffleBottomN = useCallback(() => {
    if (gameId == null) {
      return;
    }
    setPrompt({
      title: 'Shuffle bottom N cards',
      label: 'Number of cards',
      initialValue: '1',
      validate: (v) => (/^[1-9]\d*$/.test(v) ? null : 'Enter a positive integer'),
      onSubmit: (value) => {
        const n = Number(value);
        // Cockatrice player_actions.cpp:272 — negative `start` indexes from
        // the end of the zone; end=-1 means the last card.
        webClient.request.game.shuffle(gameId, {
          zoneName: Enriched.ZoneName.DECK,
          start: -n,
          end: -1,
        });
        setPrompt(null);
      },
    });
  }, [gameId, webClient]);

  // Move every card in source zone → target via one moveCard each.
  const handleRequestMoveAllFromZoneToDeck = useCallback(
    (top: boolean) => {
      if (gameId == null || zoneMenu == null || game == null) {
        return;
      }
      const sourcePlayerId = zoneMenu.playerId;
      const sourceZoneName = zoneMenu.zoneName;
      const sourceZone = game.players[sourcePlayerId]?.zones[sourceZoneName];
      if (!sourceZone) {
        return;
      }
      for (const cardId of sourceZone.order) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: sourcePlayerId,
          startZone: sourceZoneName,
          cardsToMove: { card: [{ cardId }] },
          targetPlayerId: sourcePlayerId,
          targetZone: Enriched.ZoneName.DECK,
          x: top ? 0 : -1,
          y: 0,
          isReversed: false,
        });
      }
    },
    [game, gameId, webClient, zoneMenu],
  );

  const handleRequestMoveAllFromZoneTo = useCallback(
    (targetZone: string) => {
      if (gameId == null || zoneMenu == null || game == null) {
        return;
      }
      const sourcePlayerId = zoneMenu.playerId;
      const sourceZoneName = zoneMenu.zoneName;
      const sourceZone = game.players[sourcePlayerId]?.zones[sourceZoneName];
      if (!sourceZone) {
        return;
      }
      for (const cardId of sourceZone.order) {
        webClient.request.game.moveCard(gameId, {
          startPlayerId: sourcePlayerId,
          startZone: sourceZoneName,
          cardsToMove: { card: [{ cardId }] },
          targetPlayerId: sourcePlayerId,
          targetZone,
          x: 0,
          y: 0,
          isReversed: false,
        });
      }
    },
    [game, gameId, webClient, zoneMenu],
  );

  // Client-only zone-view (no server roundtrip).
  const handleRequestViewZone = useCallback(() => {
    if (zoneMenu == null) {
      return;
    }
    handleZoneClick(zoneMenu.playerId, zoneMenu.zoneName);
  }, [handleZoneClick, zoneMenu]);

  const handleRequestRevealRandomFromZone = useCallback(() => {
    if (gameId == null || zoneMenu == null) {
      return;
    }
    const sourceZoneName = zoneMenu.zoneName;
    const label =
      sourceZoneName === Enriched.ZoneName.GRAVE ? 'Graveyard'
        : sourceZoneName === Enriched.ZoneName.EXILE ? 'Exile'
          : sourceZoneName;
    // See .github/instructions/webatrice-game.instructions.md#dialog-parity.
    const RANDOM_CARD_FROM_ZONE = -2;
    setRevealState({
      title: `Reveal random card from ${label.toLowerCase()}`,
      zoneName: sourceZoneName,
      zoneLabel: `${label} (random)`,
      showCountInput: false,
      defaultCount: 1,
      onSubmit: ({ targetPlayerId }) => {
        webClient.request.game.revealCards(gameId, {
          zoneName: sourceZoneName,
          cardId: [RANDOM_CARD_FROM_ZONE],
          playerId: targetPlayerId,
          topCards: -1,
        });
        setRevealState(null);
      },
    });
  }, [gameId, webClient, zoneMenu]);

  const confirmConcede = useCallback(() => {
    if (gameId != null) {
      webClient.request.game.concede(gameId);
    }
    setConcedeConfirm(null);
  }, [gameId, webClient]);

  const confirmUnconcede = useCallback(() => {
    if (gameId != null) {
      webClient.request.game.unconcede(gameId);
    }
    setConcedeConfirm(null);
  }, [gameId, webClient]);

  return {
    cardMenu,
    zoneMenu,
    playerMenu,
    handMenu,
    closeCardMenu: useCallback(() => setCardMenu(null), []),
    closeZoneMenu: useCallback(() => setZoneMenu(null), []),
    closePlayerMenu: useCallback(() => setPlayerMenu(null), []),
    closeHandMenu: useCallback(() => setHandMenu(null), []),
    handleCardContextMenu,
    handleZoneContextMenu,
    handlePlayerContextMenu,
    handleHandContextMenu,

    zoneViews,
    handleZoneClick,
    handleCloseZoneView,

    prompt,
    closePrompt: useCallback(() => setPrompt(null), []),

    rollDieOpen,
    lastDieSides,
    lastDieCount,
    openRollDie: useCallback(() => setRollDieOpen(true), []),
    closeRollDie: useCallback(() => setRollDieOpen(false), []),
    handleRollDieSubmit,

    createTokenOpen,
    openCreateToken: useCallback(() => setCreateTokenOpen(true), []),
    closeCreateToken: useCallback(() => setCreateTokenOpen(false), []),
    handleCreateTokenSubmit,

    sideboardOpen,
    openSideboard: useCallback(() => setSideboardOpen(true), []),
    closeSideboard: useCallback(() => setSideboardOpen(false), []),
    handleSideboardSubmit,
    handleToggleSideboardLock,

    gameInfoOpen,
    openGameInfo: useCallback(() => setGameInfoOpen(true), []),
    closeGameInfo: useCallback(() => setGameInfoOpen(false), []),

    concedeConfirm,
    openConcede: useCallback(() => setConcedeConfirm('concede'), []),
    openUnconcede: useCallback(() => setConcedeConfirm('unconcede'), []),
    closeConcedeConfirm: useCallback(() => setConcedeConfirm(null), []),
    confirmConcede,
    confirmUnconcede,

    revealState,
    closeReveal: useCallback(() => setRevealState(null), []),

    handleRequestSetPT,
    handleRequestSetAnnotation,
    handleRequestSetCardCounter,
    handleRequestDrawArrow,
    handleRequestAttach,
    handleRequestPlayFromCardMenu,
    handleRequestMoveToLibraryAt,
    handleRequestDrawN,
    handleRequestDumpN,
    handleRequestRevealTopN,
    handleRequestRevealZone,
    handleRequestChooseMulligan,
    handleRequestRevealHand,
    handleRequestRevealRandom,
    handleRequestViewHand,
    handleRequestSortHandBy,
    handleRequestMoveHandToDeck,
    handleRequestMoveHandToZone,

    handleRequestUndoDraw,
    handleRequestDrawBottom,
    handleRequestMoveTopCardToZone,
    handleRequestPlayTop,
    handleRequestMoveTopNToZone,
    handleRequestShuffleTopN,
    handleRequestShuffleBottomN,

    handleRequestViewZone,
    handleRequestMoveAllFromZoneToDeck,
    handleRequestMoveAllFromZoneTo,
    handleRequestRevealRandomFromZone,
  };
}
