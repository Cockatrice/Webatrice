import type { RefObject } from 'react';

import { useMarquee, type MarqueeRect } from '../../../hooks/useMarquee';
import type { SeatSelection, SeatSelectionApi } from '../../../hooks/useSeatSelection';

type Selection = SeatSelection;

/** Where a marquee started — one of the three selectable zones. A single
 *  marquee never bridges zones; for battlefield, the owning player id is
 *  part of the identity so different battlefields count as different
 *  zones. */
type MarqueeStartZone =
  | { zone: 'battlefield'; ownerId: string }
  | { zone: 'hand' }
  | { zone: 'stack' };

export interface UseSeatMarqueeArgs {
  playerId: number;
  handRef: RefObject<HTMLElement | null>;
  stackRef: RefObject<HTMLElement | null>;
  setSelection: SeatSelectionApi['setSelection'];
  clearAllSelection: SeatSelectionApi['clearAllSelection'];
}

export function useSeatMarquee({ playerId, handRef, stackRef, setSelection, clearAllSelection }: UseSeatMarqueeArgs) {
  const { marquee, begin } = useMarquee<MarqueeStartZone | null>((rect, startZone) => {
    if (!startZone) {
      return 0;
    }
    const { own } = computeMarqueeSelection(rect, startZone);
    setSelection(own);
    return own?.ids.size ?? 0;
  });

  // Which zone the given viewport point falls in, or null if none. For
  // battlefield, we scan EVERY player's battlefield globally and return
  // the owner id so each board counts as its own zone. Hand/stack are
  // per-player private and only checked against the viewer's own refs.
  const zoneAtPoint = (x: number, y: number): MarqueeStartZone | null => {
    const bfEls = document.querySelectorAll<HTMLElement>(
      '[data-battlefield-owner]',
    );
    for (const el of bfEls) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return {
          zone: 'battlefield',
          ownerId: el.dataset.battlefieldOwner ?? '',
        };
      }
    }
    const hit = (el: HTMLElement | null) => {
      if (!el) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    if (hit(handRef.current)) {
      return { zone: 'hand' };
    }
    if (hit(stackRef.current)) {
      return { zone: 'stack' };
    }
    return null;
  };

  // Enumerate card elements intersecting the marquee rect across every
  // zone the marquee could touch, then pick a single zone to select from.
  //
  // Rules:
  //   1. Cards intersecting the rect are grouped by zone. Each
  //      battlefield is a separate zone (keyed by owner).
  //   2. If only one zone has intersecting cards → select those,
  //      regardless of whether that zone matches the start point.
  //   3. If multiple zones have intersecting cards → prefer the start
  //      zone. If the start zone isn't among them, fall back to a fixed
  //      priority (battlefield > hand > stack).
  //
  // This lets a marquee that begins in an empty spot (e.g. stack) still
  // catch cards elsewhere, while preventing accidental mixed selections
  // when the rect straddles two zones that both contain cards.
  const computeMarqueeSelection = (
    rect: MarqueeRect,
    startZone: MarqueeStartZone,
  ): { own: Selection | null; foreign: Map<string, Set<string>> } => {
    const disjoint = (r: DOMRect) =>
      r.right < rect.left ||
      r.left > rect.right ||
      r.bottom < rect.top ||
      r.top > rect.bottom;

    // key → { ownerId?, ids }. Keys: "hand", "stack", "battlefield:<id>".
    type Bucket = { ownerId?: string; ids: Set<string> };
    const byZone = new Map<string, Bucket>();
    const addHit = (key: string, id: string, ownerId?: string) => {
      const b = byZone.get(key) ?? { ownerId, ids: new Set<string>() };
      b.ids.add(id);
      byZone.set(key, b);
    };

    const zoneRoots = { hand: handRef.current, stack: stackRef.current } as const;
    (['hand', 'stack'] as const).forEach((z) => {
      const root = zoneRoots[z];
      if (root) {
        const els = root.querySelectorAll<HTMLElement>(
          `[data-card][data-zone="${z}"]`,
        );
        els.forEach((el) => {
          const id = el.dataset.cardId;
          if (!id) {
            return;
          }
          if (disjoint(el.getBoundingClientRect())) {
            return;
          }
          addHit(z, id);
        });
      }
    });
    const bfEls = document.querySelectorAll<HTMLElement>(
      '[data-battlefield-owner]',
    );
    bfEls.forEach((bfEl) => {
      const ownerId = bfEl.dataset.battlefieldOwner ?? '';
      const key = `battlefield:${ownerId}`;
      const cardEls = bfEl.querySelectorAll<HTMLElement>(
        '[data-card][data-zone="battlefield"]',
      );
      cardEls.forEach((el) => {
        const id = el.dataset.cardId;
        if (!id) {
          return;
        }
        if (disjoint(el.getBoundingClientRect())) {
          return;
        }
        addHit(key, id, ownerId);
      });
    });

    if (byZone.size === 0) {
      return { own: null, foreign: new Map() };
    }

    const startKey =
      startZone.zone === 'battlefield'
        ? `battlefield:${startZone.ownerId}`
        : startZone.zone;
    const rank = (k: string) => {
      if (k.startsWith('battlefield:')) {
        return 0;
      }
      if (k === 'hand') {
        return 1;
      }
      if (k === 'stack') {
        return 2;
      }
      return 3;
    };
    let winnerKey: string;
    if (byZone.size === 1) {
      winnerKey = byZone.keys().next().value as string;
    } else if (byZone.has(startKey)) {
      winnerKey = startKey;
    } else {
      winnerKey = [...byZone.keys()].sort((a, b) => rank(a) - rank(b))[0];
    }

    const winner = byZone.get(winnerKey)!;
    if (winnerKey === 'hand') {
      return { own: { zone: 'hand', ids: winner.ids }, foreign: new Map() };
    }
    if (winnerKey === 'stack') {
      return { own: { zone: 'stack', ids: winner.ids }, foreign: new Map() };
    }
    // Battlefield: own if we own it, foreign otherwise.
    if (winner.ownerId === String(playerId)) {
      return {
        own: { zone: 'battlefield', ids: winner.ids },
        foreign: new Map(),
      };
    }
    return {
      own: null,
      foreign: new Map([[winner.ownerId ?? '', winner.ids]]),
    };
  };

  // Seat root pointerdown: start a marquee when the click landed on
  // background (not on any card/pile). Both viewer + opponent boxes handle
  // this — opponent boxes forward to the viewer's seat via
  // `onMarqueeStart` so a marquee can begin over any battlefield.
  const onPointerDownBox = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    const target = e.target as HTMLElement | null;
    // Card wrappers, library, graveyard, and exile all have their own
    // pointerdown; let them handle it (they'll manage selection state).
    // Also skip clicks that land inside a floating context menu —
    // React events on portal-rendered menus bubble through the React
    // tree back to this seat, and treating a menu-item click as
    // "clicked empty background" would clear the marquee selection
    // BEFORE the item's click handler fires, causing the item to
    // rebuild against a stale (null) selection.
    if (
      target?.closest('[data-card]') ||
      target?.closest('[data-drag-source]') ||
      target?.closest('[role="menu"]')
    ) {
      return;
    }
    // Clicks on a scrollbar (e.g. the hand's horizontal scrollbar) fire
    // pointerdown on the scrolling element with the pointer sitting past
    // clientWidth/clientHeight. Those aren't marquee gestures.
    if (target) {
      const rect = target.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const onHScrollbar =
        target.scrollWidth > target.clientWidth &&
        localY > target.clientHeight;
      const onVScrollbar =
        target.scrollHeight > target.clientHeight &&
        localX > target.clientWidth;
      if (onHScrollbar || onVScrollbar) {
        return;
      }
    }
    // Both self and opponent boxes start their own local marquee —
    // each battlefield owns its own selection (Cockatrice parity).
    // Starting one clears the selection on every seat.
    clearAllSelection();
    begin(e, zoneAtPoint(e.clientX, e.clientY));
  };

  return { marquee, onPointerDownBox };
}
