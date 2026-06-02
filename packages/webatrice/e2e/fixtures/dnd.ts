import { type Locator, type Page } from '@playwright/test';

// Drives a dnd-kit pointer drag. The board's PointerSensor uses
// `activationConstraint: { distance: 0 }` (useGame.ts), so a single move after
// mouse-down starts the drag; the multi-step moves below let dnd-kit's
// rectIntersection collision detection settle over the target before release.
// Hovering the target in two passes (a long travel, then a short settle) is what
// makes the drop land reliably in a real browser without an activation delay.
//
// Pointer-driven drag was a documented Playwright deferrable — this is the
// shared helper that enables it. If a drop flakes, raise the settle `steps`.
export async function dragTo(page: Page, source: Locator, target: Locator): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  await target.scrollIntoViewIfNeeded();
  const t = await target.boundingBox();
  if (!s || !t) {
    throw new Error('dragTo: source or target has no bounding box (not visible?).');
  }

  const sx = s.x + s.width / 2;
  const sy = s.y + s.height / 2;
  const tx = t.x + t.width / 2;
  const ty = t.y + t.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Clear the activation threshold and start the drag.
  await page.mouse.move(sx + 12, sy + 12, { steps: 5 });
  // Travel to the target, then settle so collision detection resolves it.
  await page.mouse.move(tx, ty, { steps: 15 });
  await page.mouse.move(tx, ty, { steps: 5 });
  await page.mouse.up();
}
