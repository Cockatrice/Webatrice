import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import { useSettings } from '@app/hooks';
import { useWebClient } from '@cockatrice/datatrice/react';
import { CardAttribute, ServerInfo_Card } from '@cockatrice/sockatrice/generated';
import { Enriched, GameEntry } from '@cockatrice/datatrice';
import { ArrowColor, ColorRGBA, rgbaToCss } from '@app/types';
import { makeCardKey, makePlayerKey, type CardRegistry } from '../utils/CardRegistry/CardRegistryContext';
import { dispatchBulkTap } from '../utils/bulkCardActions';
import { useJudgeTarget } from './useJudgeTarget';
import { bulkTargetsFor, type SelectedCard } from '../utils/selection';

import { playCardViaTableRow } from './playCard';

interface CardSource {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
}

type Pending =
  | { kind: 'arrow'; source: CardSource }
  | { kind: 'attach'; source: CardSource };

interface ArrowDragState {
  sourcePlayerId: number;
  sourceZone: string;
  sourceCardId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
}

export interface ArrowDragPreview {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface GameArrowInteractions {
  arrowSourceKey: string | null;
  arrowTargetKey: string | null;
  dragPreview: ArrowDragPreview | null;
  // True while an arrow/attach is pending (used to gate box-select + clicks).
  pending: boolean;
  handleBoardMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleCardClick: (
    ownerPlayerId: number | undefined,
    zone: string | undefined,
    card: ServerInfo_Card,
  ) => void;
  handleCardDoubleClick: (sourcePlayerId: number | undefined, sourceZone: string | undefined, card: ServerInfo_Card) => void;
  handlePlayerClick: (targetPlayerId: number) => boolean;
  startPendingArrow: (source: CardSource) => void;
  startPendingAttach: (source: CardSource) => void;
  cancelPendingOnDragStart: () => void;
}

export interface UseGameArrowInteractionsArgs {
  gameId: number | undefined;
  game: GameEntry | undefined;
  containerRef: RefObject<HTMLDivElement>;
  cardRegistry: CardRegistry;
  // Resolved multi-selection + the collapse-unless-selected helper, so click and
  // double-click apply the collapse rule and bulk-tap a preserved selection.
  selectedCards: readonly SelectedCard[];
  collapseUnlessSelected: (
    ownerPlayerId: number | undefined,
    zone: string | undefined,
    card: ServerInfo_Card,
  ) => void;
}

function arrowColorForModifiers(e: {
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): ColorRGBA {
  if (e.ctrlKey) {
    return ArrowColor.YELLOW;
  }
  if (e.altKey) {
    return ArrowColor.BLUE;
  }
  if (e.shiftKey) {
    return ArrowColor.GREEN;
  }
  return ArrowColor.RED;
}

const ARROW_DRAG_THRESHOLD_PX = 4;

export function useGameArrowInteractions({
  gameId,
  game,
  containerRef,
  cardRegistry,
  selectedCards,
  collapseUnlessSelected,
}: UseGameArrowInteractionsArgs): GameArrowInteractions {
  const webClient = useWebClient();
  const judgeTarget = useJudgeTarget(gameId);
  const { value: settings } = useSettings();
  const invertVerticalCoordinate = settings?.invertVerticalCoordinate ?? false;

  const [pending, setPending] = useState<Pending | null>(null);
  const [arrowDrag, setArrowDrag] = useState<ArrowDragState | null>(null);
  const [arrowTargetKey, setArrowTargetKey] = useState<string | null>(null);

  // ESC cancels pending arrow/attach unless a MUI dialog has it first.
  useEffect(() => {
    if (!pending && !arrowDrag) {
      return undefined;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      if (document.querySelector('.MuiDialog-root[role="dialog"]')) {
        return;
      }
      setPending(null);
      setArrowDrag(null);
      setArrowTargetKey(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pending, arrowDrag]);

  // Right-click-drag arrow lifecycle: window mousemove + mouseup.
  useEffect(() => {
    if (!arrowDrag) {
      return undefined;
    }

    const handleMove = (e: MouseEvent) => {
      setArrowDrag((prev) => {
        if (!prev) {
          return prev;
        }
        const movedX = Math.abs(e.clientX - prev.startX);
        const movedY = Math.abs(e.clientY - prev.startY);
        const moved = prev.moved || movedX + movedY > ARROW_DRAG_THRESHOLD_PX;
        if (moved) {
          const hit = document.elementFromPoint(e.clientX, e.clientY);
          const cardEl = hit?.closest('[data-card-id]') as HTMLElement | null;
          if (cardEl) {
            const tPlayerId = Number(cardEl.getAttribute('data-card-owner'));
            const tZone = cardEl.getAttribute('data-card-zone') ?? '';
            const tCardId = Number(cardEl.getAttribute('data-card-id'));
            if (Number.isFinite(tPlayerId) && tZone && Number.isFinite(tCardId)) {
              const key = makeCardKey(tPlayerId, tZone, tCardId);
              const sourceKey = makeCardKey(prev.sourcePlayerId, prev.sourceZone, prev.sourceCardId);
              setArrowTargetKey(key === sourceKey ? null : key);
            } else {
              setArrowTargetKey(null);
            }
          } else {
            const playerEl = hit?.closest('[data-arrow-target-kind="player"]') as HTMLElement | null;
            if (playerEl) {
              const tPlayerId = Number(playerEl.getAttribute('data-arrow-target-player-id'));
              if (Number.isFinite(tPlayerId)) {
                setArrowTargetKey(makePlayerKey(tPlayerId));
              } else {
                setArrowTargetKey(null);
              }
            } else {
              setArrowTargetKey(null);
            }
          }
        }
        return { ...prev, currentX: e.clientX, currentY: e.clientY, moved };
      });
    };

    const handleUp = (e: MouseEvent) => {
      if (e.button !== 2) {
        return;
      }
      const drag = arrowDrag;
      if (!drag) {
        return;
      }
      const movedX = Math.abs(e.clientX - drag.startX);
      const movedY = Math.abs(e.clientY - drag.startY);
      const moved = drag.moved || movedX + movedY > ARROW_DRAG_THRESHOLD_PX;
      setArrowDrag(null);
      setArrowTargetKey(null);
      if (!moved || gameId == null) {
        // Short right-click with no drag: let the contextmenu handler run
        // (it will open the card menu).
        return;
      }
      // Any real drag suppresses the contextmenu event that follows mouseup.
      // Capture phase + stopPropagation is required so the event never reaches
      // React's delegated root listener (which would open the card menu).
      window.addEventListener(
        'contextmenu',
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        },
        { once: true, capture: true },
      );

      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const cardEl = hit?.closest('[data-card-id]') as HTMLElement | null;
      let targetPlayerId: number;
      let targetZone = '';
      let targetCardId = -1;
      let isPlayerTarget = false;
      if (cardEl) {
        targetPlayerId = Number(cardEl.getAttribute('data-card-owner'));
        targetZone = cardEl.getAttribute('data-card-zone') ?? '';
        targetCardId = Number(cardEl.getAttribute('data-card-id'));
        if (!Number.isFinite(targetPlayerId) || !targetZone || !Number.isFinite(targetCardId)) {
          return;
        }
      } else {
        const playerEl = hit?.closest('[data-arrow-target-kind="player"]') as HTMLElement | null;
        if (!playerEl) {
          return;
        }
        targetPlayerId = Number(playerEl.getAttribute('data-arrow-target-player-id'));
        if (!Number.isFinite(targetPlayerId)) {
          return;
        }
        isPlayerTarget = true;
      }
      // Same-card drops are cancellations (card targets only).
      if (
        !isPlayerTarget &&
        targetPlayerId === drag.sourcePlayerId &&
        targetZone === drag.sourceZone &&
        targetCardId === drag.sourceCardId
      ) {
        return;
      }
      // proto2 field-presence: omit targetZone/targetCardId for player targets
      // so Servatrice's has_target_zone()/has_target_card_id() return false
      // and routes the command as "player is targeted" per command_create_arrow.proto.
      const targetFields = isPlayerTarget ? {} : { targetZone, targetCardId };
      // Local-hand arrow → non-hand plays the card AND draws the arrow.
      // Mirrors desktop arrow_item.cpp:223-282 — start_zone is rewritten to
      // the post-play zone (TABLE or STACK) while start_card_id stays the
      // hand-side id; Servatrice resolves it against the freshly-moved card.
      if (
        drag.sourceZone === Enriched.ZoneName.HAND &&
        drag.sourcePlayerId === game?.localPlayerId &&
        targetZone !== Enriched.ZoneName.HAND
      ) {
        const sourceCard = game?.players[drag.sourcePlayerId]?.zones[Enriched.ZoneName.HAND]?.byId[drag.sourceCardId];
        const arrowColor = arrowColorForModifiers(e);
        if (sourceCard) {
          void (async () => {
            const postPlayZone = await playCardViaTableRow({
              webClient,
              gameId,
              localPlayerId: drag.sourcePlayerId,
              sourcePlayerId: drag.sourcePlayerId,
              sourceZone: Enriched.ZoneName.HAND,
              card: sourceCard,
              faceDown: false,
              isInverted: invertVerticalCoordinate,
              tableZone: game?.players[drag.sourcePlayerId]?.zones[Enriched.ZoneName.TABLE],
            });
            webClient.request.game.createArrow(gameId, {
              startPlayerId: drag.sourcePlayerId,
              startZone: postPlayZone,
              startCardId: drag.sourceCardId,
              targetPlayerId,
              ...targetFields,
              arrowColor,
            });
          })();
        }
        return;
      }
      webClient.request.game.createArrow(gameId, {
        startPlayerId: drag.sourcePlayerId,
        startZone: drag.sourceZone,
        startCardId: drag.sourceCardId,
        targetPlayerId,
        ...targetFields,
        arrowColor: arrowColorForModifiers(e),
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [arrowDrag, gameId, webClient, game, invertVerticalCoordinate]);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 2) {
      return;
    }
    const el = (e.target as HTMLElement).closest('[data-card-id]') as HTMLElement | null;
    if (!el) {
      return;
    }
    const sourcePlayerId = Number(el.getAttribute('data-card-owner'));
    const sourceZone = el.getAttribute('data-card-zone') ?? '';
    const sourceCardId = Number(el.getAttribute('data-card-id'));
    if (!Number.isFinite(sourcePlayerId) || !sourceZone || !Number.isFinite(sourceCardId)) {
      return;
    }
    setArrowDrag({
      sourcePlayerId,
      sourceZone,
      sourceCardId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      moved: false,
    });
  }, []);

  const arrowSourceKey = pending
    ? makeCardKey(pending.source.sourcePlayerId, pending.source.sourceZone, pending.source.sourceCardId)
    : arrowDrag
      ? makeCardKey(arrowDrag.sourcePlayerId, arrowDrag.sourceZone, arrowDrag.sourceCardId)
      : null;

  // viewport → board-relative coords for the SVG preview line.
  const dragPreview = useMemo<ArrowDragPreview | null>(() => {
    if (!arrowDrag || !arrowDrag.moved) {
      return null;
    }
    const containerRect = containerRef.current?.getBoundingClientRect();
    const sourceEl = cardRegistry.get(
      makeCardKey(arrowDrag.sourcePlayerId, arrowDrag.sourceZone, arrowDrag.sourceCardId),
    );
    if (!containerRect || !sourceEl) {
      return null;
    }
    const sourceRect = sourceEl.getBoundingClientRect();
    return {
      x1: sourceRect.left + sourceRect.width / 2 - containerRect.left,
      y1: sourceRect.top + sourceRect.height / 2 - containerRect.top,
      x2: arrowDrag.currentX - containerRect.left,
      y2: arrowDrag.currentY - containerRect.top,
      color: rgbaToCss(ArrowColor.RED),
    };
  }, [arrowDrag, cardRegistry, containerRef]);

  const handleCardClick = useCallback(
    (ownerPlayerId: number | undefined, zone: string | undefined, card: ServerInfo_Card) => {
      if (gameId == null || ownerPlayerId == null || zone == null) {
        return;
      }

      if (!pending) {
        // No pending arrow → plain selection click: collapse-unless-selected.
        collapseUnlessSelected(ownerPlayerId, zone, card);
        return;
      }
      const src = pending.source;
      const isSameCard =
        src.sourcePlayerId === ownerPlayerId &&
        src.sourceZone === zone &&
        src.sourceCardId === card.id;

      if (pending.kind === 'attach') {
        if (isSameCard) {
          setPending(null);
          return;
        }
        // A judge attaching a foreign card wraps it as the source card's owner. See useJudgeTarget.
        webClient.request.game.attachCard(gameId, {
          startZone: src.sourceZone,
          cardId: src.sourceCardId,
          targetPlayerId: ownerPlayerId,
          targetZone: zone,
          targetCardId: card.id,
        }, judgeTarget(src.sourcePlayerId));
        setPending(null);
        return;
      }

      // pending.kind === 'arrow'
      if (isSameCard) {
        setPending(null);
        return;
      }
      // Local-hand arrow → non-hand plays the card AND draws the arrow.
      // Mirrors desktop arrow_item.cpp:223-282.
      if (
        src.sourceZone === Enriched.ZoneName.HAND &&
        src.sourcePlayerId === game?.localPlayerId &&
        zone !== Enriched.ZoneName.HAND
      ) {
        const sourceCard = game?.players[src.sourcePlayerId]?.zones[Enriched.ZoneName.HAND]?.byId[src.sourceCardId];
        if (sourceCard) {
          void (async () => {
            const postPlayZone = await playCardViaTableRow({
              webClient,
              gameId,
              localPlayerId: src.sourcePlayerId,
              sourcePlayerId: src.sourcePlayerId,
              sourceZone: Enriched.ZoneName.HAND,
              card: sourceCard,
              faceDown: false,
              isInverted: invertVerticalCoordinate,
              tableZone: game?.players[src.sourcePlayerId]?.zones[Enriched.ZoneName.TABLE],
            });
            webClient.request.game.createArrow(gameId, {
              startPlayerId: src.sourcePlayerId,
              startZone: postPlayZone,
              startCardId: src.sourceCardId,
              targetPlayerId: ownerPlayerId,
              targetZone: zone,
              targetCardId: card.id,
              arrowColor: ArrowColor.RED,
            });
          })();
        }
        setPending(null);
        return;
      }
      webClient.request.game.createArrow(gameId, {
        startPlayerId: src.sourcePlayerId,
        startZone: src.sourceZone,
        startCardId: src.sourceCardId,
        targetPlayerId: ownerPlayerId,
        targetZone: zone,
        targetCardId: card.id,
        arrowColor: ArrowColor.RED,
      });
      setPending(null);
    },
    [gameId, game, invertVerticalCoordinate, pending, webClient, collapseUnlessSelected, judgeTarget],
  );

  const handleCardDoubleClick = useCallback(
    (sourcePlayerId: number | undefined, sourceZone: string | undefined, card: ServerInfo_Card) => {
      if (gameId == null || sourceZone == null) {
        return;
      }
      // Pending arrow/attach owns the pointer; skip double-click.
      if (pending) {
        return;
      }
      // Double-clicking a card that's part of a multi-selection bulk-taps the
      // TABLE subset (Cockatrice collective rule); the selection is preserved.
      if (sourceZone === Enriched.ZoneName.TABLE && sourcePlayerId != null) {
        const bulk = bulkTargetsFor(selectedCards, makeCardKey(sourcePlayerId, sourceZone, card.id));
        if (bulk.length) {
          dispatchBulkTap(webClient, gameId, bulk.filter((t) => t.zone === Enriched.ZoneName.TABLE));
          return;
        }
      }
      collapseUnlessSelected(sourcePlayerId, sourceZone, card);
      if (sourceZone === Enriched.ZoneName.TABLE) {
        webClient.request.game.setCardAttr(gameId, {
          zone: sourceZone,
          cardId: card.id,
          attribute: CardAttribute.AttrTapped,
          attrValue: card.tapped ? '0' : '1',
        });
        return;
      }
      if (sourceZone === Enriched.ZoneName.HAND && game?.localPlayerId != null) {
        const localPlayerId = game.localPlayerId;
        // Local target is never per-player mirrored; honor invertVerticalCoordinate for wire y.
        void playCardViaTableRow({
          webClient,
          gameId,
          localPlayerId,
          sourcePlayerId: localPlayerId,
          sourceZone: Enriched.ZoneName.HAND,
          card,
          faceDown: false,
          isInverted: invertVerticalCoordinate,
          tableZone: game.players[localPlayerId]?.zones[Enriched.ZoneName.TABLE],
        });
      }
    },
    [gameId, game, invertVerticalCoordinate, pending, webClient, selectedCards, collapseUnlessSelected],
  );

  // Returns true iff a pending arrow was resolved against this player. Callers
  // use the return value to suppress the player-select dropdown's own click.
  const handlePlayerClick = useCallback(
    (targetPlayerId: number): boolean => {
      if (gameId == null || !pending || pending.kind !== 'arrow') {
        return false;
      }
      const src = pending.source;
      // Omit targetZone + targetCardId so the proto2 fields stay unset and
      // Servatrice routes this as a player-targeted arrow.
      webClient.request.game.createArrow(gameId, {
        startPlayerId: src.sourcePlayerId,
        startZone: src.sourceZone,
        startCardId: src.sourceCardId,
        targetPlayerId,
        arrowColor: ArrowColor.RED,
      });
      setPending(null);
      return true;
    },
    [gameId, pending, webClient],
  );

  const startPendingArrow = useCallback((source: CardSource) => {
    setPending({ kind: 'arrow', source });
  }, []);

  const startPendingAttach = useCallback((source: CardSource) => {
    setPending({ kind: 'attach', source });
  }, []);

  const cancelPendingOnDragStart = useCallback(() => {
    setPending(null);
  }, []);

  return {
    arrowSourceKey,
    arrowTargetKey,
    dragPreview,
    pending: pending != null,
    handleBoardMouseDown,
    handleCardClick,
    handleCardDoubleClick,
    handlePlayerClick,
    startPendingArrow,
    startPendingAttach,
    cancelPendingOnDragStart,
  };
}
