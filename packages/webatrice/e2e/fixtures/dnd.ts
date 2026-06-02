import { type Locator, type Page } from '@playwright/test';

export interface DragOptions {
  // Absolute viewport point to release on, overriding the target's center. Use
  // when the target's center is occluded by a floating popup (zone-view dialogs
  // are z-index:1200 above the board) and the drop must land on a visible part
  // of the target — collision detection is z-order aware, so a release point
  // outside the popup lets the board target win (see useGameDnd.ts).
  to?: { x: number; y: number };
}

// Drives a dnd-kit pointer drag. The board's PointerSensor uses
// `activationConstraint: { distance: 0 }` (useGame.ts), so a single move after
// mouse-down starts the drag; the multi-step moves below let dnd-kit's
// rectIntersection collision detection settle over the target before release.
// Hovering the target in two passes (a long travel, then a short settle) is what
// makes the drop land reliably in a real browser without an activation delay.
//
// Pointer-driven drag was a documented Playwright deferrable — this is the
// shared helper that enables it. If a drop flakes, raise the settle `steps`.
export async function dragTo(
  page: Page,
  source: Locator,
  target: Locator,
  opts: DragOptions = {},
): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  await target.scrollIntoViewIfNeeded();
  const t = await target.boundingBox();
  if (!s || !t) {
    throw new Error('dragTo: source or target has no bounding box (not visible?).');
  }

  const sx = s.x + s.width / 2;
  const sy = s.y + s.height / 2;
  const tx = opts.to ? opts.to.x : t.x + t.width / 2;
  const ty = opts.to ? opts.to.y : t.y + t.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Clear the activation threshold and start the drag.
  await page.mouse.move(sx + 12, sy + 12, { steps: 5 });
  // Travel to the target, then settle so collision detection resolves it.
  await page.mouse.move(tx, ty, { steps: 15 });
  await page.mouse.move(tx, ty, { steps: 5 });
  await page.mouse.up();
}

// Repositions a draggable zone-view popup by dragging its header so the dialog's
// top-left corner lands at (toX, toY). The header drag is delta-based and uses
// pointer events captured on the header (useZoneViewDialog.handlePointerDown),
// not dnd-kit — so a plain mouse drag drives it. Used to move a large popup off
// the board area it would otherwise blanket before dragging a card out of it.
export async function movePopupTo(
  page: Page,
  dialog: Locator,
  header: Locator,
  toX: number,
  toY: number,
): Promise<void> {
  const d = await dialog.boundingBox();
  const h = await header.boundingBox();
  if (!d || !h) {
    throw new Error('movePopupTo: dialog or header has no bounding box (not visible?).');
  }
  const hx = h.x + h.width / 2;
  const hy = h.y + h.height / 2;
  // position is updated by pointer delta, so shift the header by (target - current top-left).
  const dx = toX - d.x;
  const dy = toY - d.y;

  await page.mouse.move(hx, hy);
  await page.mouse.down();
  await page.mouse.move(hx + dx, hy + dy, { steps: 10 });
  await page.mouse.up();
}
