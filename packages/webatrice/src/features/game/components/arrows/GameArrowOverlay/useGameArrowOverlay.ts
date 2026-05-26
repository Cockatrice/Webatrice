import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { useWebClient } from '@cockatrice/datatrice/react';
import { games } from '@cockatrice/datatrice';
import { useAppSelector } from '@app/store';
import { ServerInfo_Arrow } from '@cockatrice/sockatrice/generated';
import { PlayerEntry } from '@cockatrice/datatrice';
import { ArrowColor, rgbaToCss } from '@app/types';
import { makeCardKey, makePlayerKey, useCardRegistry } from '../../../utils/CardRegistry/CardRegistryContext';

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

// Distance from the line endpoint to the visual apex of the arrowhead.
// Derived from the marker definition in GameArrowOverlay.tsx:
//   refX=10, path apex at x=12, markerWidth=10, viewBox width=14,
//   .game-arrow-overlay__head stroke-width=4.
//   overshoot = (12 - 10) * (10 / 14) * 4 ≈ 5.71px
// plus ~1.4px for the 1-unit path outline → round up to 7 so the visual
// tip clears the target rim with a tiny margin. Keep in sync with the
// marker if its geometry ever changes.
const ARROW_HEAD_TIP_OVERSHOOT_PX = 7;

function cssColor(c: { r: number; g: number; b: number; a: number } | undefined): string {
  if (!c) {
    return ARROW_FALLBACK_CSS;
  }
  return rgbaToCss({ r: c.r, g: c.g, b: c.b, a: c.a ?? 255 });
}

// Point on the circle centered at (cx,cy) with radius r along the ray from
// (sx,sy) — so the arrow head lands on the rim instead of the center. Falls
// back to the center if the source is inside the circle (degenerate).
function pointOnCircleEdge(
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number } {
  const dx = sx - cx;
  const dy = sy - cy;
  const d = Math.hypot(dx, dy);
  if (d <= r || d === 0) {
    return { x: cx, y: cy };
  }
  return { x: cx + (dx * r) / d, y: cy + (dy * r) / d };
}

export interface GameArrowOverlay {
  arrows: ResolvedArrow[];
  width: number;
  height: number;
  handleArrowClick: (arrowId: number) => void;
}

export interface UseGameArrowOverlayArgs {
  gameId: number | undefined;
  containerRef: React.RefObject<HTMLElement | null>;
}

export function useGameArrowOverlay({
  gameId,
  containerRef,
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

  // First-paint: the board ref is null during the initial render, so `containerRect`
  // is undefined and the arrows memo bails out. Bump once after mount so the
  // next render sees a populated ref.
  useLayoutEffect(() => {
    bump();
  }, [bump]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const ro = new ResizeObserver(() => bump());
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef, bump]);

  // Scroll events don't bubble, so a capturing listener on `window` is the
  // canonical way to catch every element's scroll page-wide. rAF coalesces
  // bursts to one re-measure per frame.
  useLayoutEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) {
        return;
      }
      raf = requestAnimationFrame(() => {
        raf = 0;
        bump();
      });
    };
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [bump]);

  const containerRect = containerRef.current?.getBoundingClientRect();

  const arrows = useMemo<ResolvedArrow[]>(() => {
    if (!players || !registry || !containerRect) {
      return [];
    }
    const out: ResolvedArrow[] = [];
    for (const player of Object.values(players) as PlayerEntry[]) {
      for (const a of Object.values(player.arrows) as ServerInfo_Arrow[]) {
        const sourceEl = registry.get(
          makeCardKey(a.startPlayerId, a.startZone, a.startCardId),
        );
        // proto2-unset: bufbuild drops unset optional fields from the spread
        // POJO (live path) but keeps them as defaults on the raw proto (refresh
        // path). Accept undefined, '', -1, and 0 so both paths route to the
        // player anchor. See plan/arrows-should-be-drawable-sunny-river.md.
        const isPlayerTarget =
          !a.targetZone || a.targetCardId == null || a.targetCardId === -1;
        const targetEl = registry.get(
          isPlayerTarget
            ? makePlayerKey(a.targetPlayerId)
            : makeCardKey(a.targetPlayerId, a.targetZone, a.targetCardId),
        );
        if (!sourceEl || !targetEl) {
          continue;
        }
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        const x1 = s.left + s.width / 2 - containerRect.left;
        const y1 = s.top + s.height / 2 - containerRect.top;
        const tcx = t.left + t.width / 2 - containerRect.left;
        const tcy = t.top + t.height / 2 - containerRect.top;
        // Player-target arrows anchor to the rim of the life circle; card
        // targets stay center-anchored.
        const tip = isPlayerTarget
          ? pointOnCircleEdge(
              x1,
              y1,
              tcx,
              tcy,
              Math.min(t.width, t.height) / 2 + ARROW_HEAD_TIP_OVERSHOOT_PX,
            )
          : { x: tcx, y: tcy };
        out.push({
          arrowId: a.id,
          ownerPlayerId: player.properties.playerId,
          x1,
          y1,
          x2: tip.x,
          y2: tip.y,
          color: cssColor(a.arrowColor),
        });
      }
    }
    // `tick` in deps intentionally re-runs the memo on DOM-layout changes.
    return out;
  }, [players, registry, containerRect, tick]);

  const handleArrowClick = (arrowId: number) => {
    if (gameId == null) {
      return;
    }
    webClient.request.game.deleteArrow(gameId, { arrowId });
  };

  const width = containerRect?.width ?? 0;
  const height = containerRect?.height ?? 0;

  return { arrows, width, height, handleArrowClick };
}
