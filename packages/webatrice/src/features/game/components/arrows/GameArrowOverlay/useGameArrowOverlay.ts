import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Arrow } from '@cockatrice/sockatrice/generated';
import { PlayerEntry } from '@cockatrice/datatrice';
import { ArrowColor, rgbaToCss } from '@app/types';
import { makeCardKey, useCardRegistry } from '../../../utils/CardRegistry/CardRegistryContext';

export interface ResolvedArrow {
  arrowId: number;
  ownerPlayerId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

const ARROW_FALLBACK_CSS = rgbaToCss(ArrowColor.RED);

function cssColor(c: { r: number; g: number; b: number; a: number } | undefined): string {
  if (!c) {
    return ARROW_FALLBACK_CSS;
  }
  return rgbaToCss({ r: c.r, g: c.g, b: c.b, a: c.a ?? 255 });
}

export interface GameArrowOverlay {
  arrows: ResolvedArrow[];
  width: number;
  height: number;
  handleArrowClick: (arrowId: number) => void;
}

export interface UseGameArrowOverlayArgs {
  gameId: number | undefined;
  boardRef: React.RefObject<HTMLElement | null>;
}

export function useGameArrowOverlay({
  gameId,
  boardRef,
}: UseGameArrowOverlayArgs): GameArrowOverlay {
  const webClient = useWebClient();
  const registry = useCardRegistry();
  const players = useAppSelector((state) =>
    gameId != null ? games.Selectors.getPlayers(state, gameId) : undefined,
  );

  // Tick is bumped whenever we need to re-query DOM rects (card registry
  // mutation, board resize). Keeps the overlay declarative without an external
  // layout engine.
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!registry) {
      return undefined;
    }
    return registry.subscribe(bump);
  }, [registry, bump]);

  // First-paint: the board ref is null during the initial render, so `boardRect`
  // is undefined and the arrows memo bails out. Bump once after mount so the
  // next render sees a populated ref.
  useLayoutEffect(() => {
    bump();
  }, [bump]);

  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const ro = new ResizeObserver(() => bump());
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardRef, bump]);

  const boardRect = boardRef.current?.getBoundingClientRect();

  const arrows = useMemo<ResolvedArrow[]>(() => {
    if (!players || !registry || !boardRect) {
      return [];
    }
    const out: ResolvedArrow[] = [];
    for (const player of Object.values(players) as PlayerEntry[]) {
      for (const a of Object.values(player.arrows) as ServerInfo_Arrow[]) {
        const sourceEl = registry.get(
          makeCardKey(a.startPlayerId, a.startZone, a.startCardId),
        );
        const targetEl = registry.get(
          makeCardKey(a.targetPlayerId, a.targetZone, a.targetCardId),
        );
        if (!sourceEl || !targetEl) {
          continue;
        }
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        out.push({
          arrowId: a.id,
          ownerPlayerId: player.properties.playerId,
          x1: s.left + s.width / 2 - boardRect.left,
          y1: s.top + s.height / 2 - boardRect.top,
          x2: t.left + t.width / 2 - boardRect.left,
          y2: t.top + t.height / 2 - boardRect.top,
          color: cssColor(a.arrowColor),
        });
      }
    }
    // `tick` in deps intentionally re-runs the memo on DOM-layout changes.
    return out;
  }, [players, registry, boardRect, tick]);

  const handleArrowClick = (arrowId: number) => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.deleteArrow(gameId, { arrowId });
  };

  const width = boardRect?.width ?? 0;
  const height = boardRect?.height ?? 0;

  return { arrows, width, height, handleArrowClick };
}
