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
        out.push({
          arrowId: a.id,
          ownerPlayerId: player.properties.playerId,
          x1: s.left + s.width / 2 - containerRect.left,
          y1: s.top + s.height / 2 - containerRect.top,
          x2: t.left + t.width / 2 - containerRect.left,
          y2: t.top + t.height / 2 - containerRect.top,
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
