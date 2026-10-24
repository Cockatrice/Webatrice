import { useEffect, useRef, useState } from 'react';

import { useCardScale } from '../../ui/CardScaleContext';
import type { BattlefieldCardViewModel } from '../../ui/PlayerBoard/playerBoard.types';
import {
  BATTLEFIELD_MIN_COLS,
  BATTLEFIELD_ROWS,
  battlefieldNaturalHeight,
  computeCellWidths,
  computeContentWidth,
  rowTopY,
  scaledBattlefieldLayout,
  slotOriginPx,
  snapPxToSlot,
} from './battlefieldLayout';
import { battlefieldSlots } from './battlefieldSlots';


export interface UseBattlefieldLayoutArgs {
  cards: readonly BattlefieldCardViewModel[];
  playerId: number;
  mirrored: boolean;
}

export function useBattlefieldLayout({ cards, playerId, mirrored }: UseBattlefieldLayoutArgs) {
  const { scale } = useCardScale();
  const battlefieldLayout = scaledBattlefieldLayout(scale);
  const CARD_W_PX = battlefieldLayout.cardWidthPx;
  const BATTLEFIELD_GAP_PX = battlefieldLayout.gapXPx;
  const STACK_OFFSET_PX = battlefieldLayout.stackOffsetXPx;
  const BATTLEFIELD_ROW_PADDING_PX = battlefieldLayout.gapYPx;
  const BATTLEFIELD_MARGIN_LEFT_PX = battlefieldLayout.marginLeftPx;
  const BATTLEFIELD_MARGIN_RIGHT_PX = battlefieldLayout.marginRightPx;

  // The battlefield has TWO refs now that it can scroll horizontally:
  //   - `scrollContainerRef`: the visible/scrollable viewport. Measured
  //     here so we know how many columns naturally fit on-screen.
  //   - `battlefieldRef`: the sized content div holding cards + slot
  //     outlines. Its explicit width grows past the viewport as the grid
  //     extends past the fit, triggering horizontal scroll.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const battlefieldRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) {
      return;
    }
    const ro = new ResizeObserver(([entry]) => {
      setFitSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { slots: battlefieldForLayout, childrenByParent: attachedChildrenByParent } = battlefieldSlots(cards, playerId, mirrored);
  // Per-cell horizontal footprint — a cell with 3 stacked cards is
  // 2×STACK_OFFSET_PX wider than a solo cell, and columns to the right
  // of it shift over by that difference. Ported from Cockatrice's
  // `TableZone::computeCardStackWidths`.
  const cellWidths = computeCellWidths(battlefieldForLayout, battlefieldLayout);
  // Effective min-cols: cap BATTLEFIELD_MIN_COLS at whatever fits in
  // the visible container width. Cockatrice enforces its 5-col MIN_WIDTH
  // via a scene-side floor and lets fitInView scale everything down to
  // fit; we hold card size fixed (height-driven scale) and instead
  // shrink the min-cols reservation so the empty grid doesn't overflow
  // horizontally. `+1` in the fit formula accounts for margins and the
  // final card not needing a trailing gap.
  const effectiveMinCols = (() => {
    if (fitSize.w <= 0) {
      return BATTLEFIELD_MIN_COLS;
    }
    const usable =
      fitSize.w - BATTLEFIELD_MARGIN_LEFT_PX - BATTLEFIELD_MARGIN_RIGHT_PX;
    const perCol = CARD_W_PX + BATTLEFIELD_GAP_PX;
    const fitCols = Math.max(1, Math.floor((usable + BATTLEFIELD_GAP_PX) / perCol));
    return Math.min(BATTLEFIELD_MIN_COLS, fitCols);
  })();
  // Per-row column count including one buffer past the rightmost card
  // (or the min-cols floor) — matches Cockatrice's "always leave a drop
  // target on the right" behavior. Used by the slot overlay to know how
  // many dashed outlines to render per row.
  const colsByRow = (() => {
    const out = new Array<number>(BATTLEFIELD_ROWS).fill(0);
    const maxCol = new Array<number>(BATTLEFIELD_ROWS).fill(-1);
    for (const c of battlefieldForLayout) {
      if (c.row >= 0 && c.row < BATTLEFIELD_ROWS) {
        maxCol[c.row] = Math.max(maxCol[c.row], c.col);
      }
    }
    for (let r = 0; r < BATTLEFIELD_ROWS; r++) {
      out[r] = Math.max(effectiveMinCols, maxCol[r] + 2);
    }
    return out;
  })();
  // Content pixel size — sum of per-row column widths + margins. When
  // stacks push columns right, or when a buffer column opens past the
  // fit width, the content grows past fitSize.w and the scroll container
  // starts scrolling horizontally.
  const naturalContentW = computeContentWidth(
    cellWidths,
    battlefieldForLayout,
    { ...battlefieldLayout, minCols: effectiveMinCols },
  );
  const naturalContentH = battlefieldNaturalHeight(battlefieldLayout);
  const dropWidth = Math.max(naturalContentW, fitSize.w);
  const colsByWireRow = Array.from({ length: BATTLEFIELD_ROWS }, (_, row) => {
    const displayRow = mirrored ? BATTLEFIELD_ROWS - 1 - row : row;
    return snapPxToSlot(
      Math.max(0, dropWidth - 0.001), rowTopY(displayRow, battlefieldLayout),
      cellWidths, battlefieldLayout,
    ).col + 1;
  });
  // Legacy slot-bound shims — group drops / nearest-available-slot search
  // originally iterated a rectangular `grid.cols × grid.rows` space; with
  // per-row column counts we use the widest row as the effective width.
  // Wire rows are fixed at BATTLEFIELD_ROWS.
  const gridRows = BATTLEFIELD_ROWS;
  const gridCols = Math.max(BATTLEFIELD_MIN_COLS, ...colsByRow);

  // Auto-scroll the battlefield to the rightmost edge whenever a
  // genuinely NEW column opens — a card placed on the buffer column
  // past the rightmost stack pushes `maxColsInAnyRow` up by one. Only
  // this case gets the scroll; stacking cards onto an EXISTING slot
  // grows that cell's width and shifts later columns right, but should
  // NOT auto-scroll (the user is looking at the stack they're building,
  // scrolling away hides it).
  const maxColsInAnyRow = colsByRow.reduce((m, n) => Math.max(m, n), 0);
  const prevMaxColsRef = useRef(maxColsInAnyRow);
  useEffect(() => {
    if (maxColsInAnyRow > prevMaxColsRef.current) {
      const el = scrollContainerRef.current;
      if (el) {
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      }
    }
    prevMaxColsRef.current = maxColsInAnyRow;
  }, [maxColsInAnyRow]);

  // Absolute (x, y) render position for every battlefield card, keyed by
  // BattlefieldCard.id. Parents get shifted right + down to make room for
  // their children; children fan diagonally left/up-under from the
  // parent. Skipped attached cards resolve normally (as if unattached)
  // if their parent isn't present on this battlefield — cross-player
  // attach or a race between events.
  const battlefieldPositions = (() => {
    const positions = new Map<string, { x: number; y: number }>();
    // Pass 1: non-attached cards. Parent-with-children get position
    // shifted right by (numChildren * stackOffsetX) and down by 15px so
    // the fanned children extend LEFT into empty space instead of
    // overlapping the parent. Ports `TableZone::reorganizeCards`.
    for (const c of cards) {
      if (
        c.attachTargetCardId != null &&
        c.attachTargetPlayerId === playerId
      ) {
        continue;
      }
      const displayRow = mirrored
        ? BATTLEFIELD_ROWS - 1 - c.slot.row
        : c.slot.row;
      const origin = slotOriginPx(
        { row: displayRow, col: c.slot.col, subSlot: c.subSlot },
        cellWidths,
        battlefieldLayout,
      );
      const numChildren = attachedChildrenByParent.get(Number(c.id))?.length ?? 0;
      positions.set(c.id, {
        x: origin.x + numChildren * STACK_OFFSET_PX,
        y: origin.y + (numChildren > 0 ? 15 * scale : 0),
      });
    }
    // Pass 2: attached children. Position relative to the parent's
    // freshly-computed x/y. First child sits just left of the parent
    // (parent.x - offset), each subsequent child steps another offset
    // further left. Y sits 5px below the parent's base — matches
    // Cockatrice's `childY = y + 5`.
    for (const c of cards) {
      if (
        c.attachTargetCardId == null ||
        c.attachTargetPlayerId !== playerId
      ) {
        continue;
      }
      const parentPos = positions.get(String(c.attachTargetCardId));
      if (!parentPos) {
        // Parent not on this battlefield (cross-player attach or race);
        // fall back to slot origin so the child at least renders.
        const displayRow = mirrored
          ? BATTLEFIELD_ROWS - 1 - c.slot.row
          : c.slot.row;
        const origin = slotOriginPx(
          { row: displayRow, col: c.slot.col, subSlot: c.subSlot },
          cellWidths,
          battlefieldLayout,
        );
        positions.set(c.id, { x: origin.x, y: origin.y });
        continue;
      }
      const siblings = attachedChildrenByParent.get(c.attachTargetCardId) ?? [];
      const idx = siblings.indexOf(c);
      // Reconstruct the PARENT'S row baseline (not the child's own).
      // Cockatrice's `childY = y + 5` uses the parent's mapped Y — an
      // attached card renders in the same row as its target regardless
      // of what slot the wire currently says the child is in. Without
      // this the child would stick to its original row when the parent
      // is elsewhere (see the "col matches but row doesn't" bug).
      const parent = cards.find(
        (bc) => Number(bc.id) === c.attachTargetCardId,
      );
      const parentRow = parent?.slot.row ?? c.slot.row;
      const displayRow = mirrored
        ? BATTLEFIELD_ROWS - 1 - parentRow
        : parentRow;
      const rowY = rowTopY(displayRow, battlefieldLayout);
      positions.set(c.id, {
        x: parentPos.x - (idx + 1) * STACK_OFFSET_PX,
        y: rowY + 5 * scale,
      });
    }
    return positions;
  })();

  return {
    battlefieldLayout,
    BATTLEFIELD_ROW_PADDING_PX,
    scrollContainerRef,
    battlefieldRef,
    cellWidths,
    colsByRow,
    colsByWireRow,
    naturalContentW,
    naturalContentH,
    gridRows,
    gridCols,
    battlefieldPositions,
  };
}
