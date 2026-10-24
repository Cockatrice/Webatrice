import { expect, test } from '@playwright/test';

import { dockReport, dockViolations } from '../fixtures/geometry';
import { openChats, openHarness } from '../fixtures/harness';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];
const CASES = [
  { open: 1, minimised: 1 },
  { open: 2, minimised: 0 },
  { open: 3, minimised: 1 },
] as const;
const SCENES = [
  { route: 'home', as: 'player' },
  { route: 'game', as: 'player' },
  { route: 'game', as: 'spectator' },
] as const;

for (const { route, as } of SCENES) {
  for (const viewport of VIEWPORTS) {
    for (const { open, minimised } of CASES) {
      const where = route === 'home' ? 'home' : `game as ${as}`;
      const title = `${where} ${viewport.width}x${viewport.height}: ${open} open + ${minimised} minimised chats tile in one bottom row`;
      test(title, async ({ page }) => {
        await page.setViewportSize(viewport);
        await openHarness(page, { route, as, players: 4 });
        await openChats(page, open, minimised);
        const report = await dockReport(page);
        const windows = report.items.filter((item) => item.kind === 'window');
        const chips = report.items.filter((item) => item.kind === 'chip');
        expect(windows.length + chips.length, 'docked chats').toBe(open + minimised);
        expect(windows.length, 'open windows').toBeGreaterThanOrEqual(1);
        expect(windows.length, 'open windows').toBeLessThanOrEqual(open);
        const failures = dockViolations(report);
        expect(failures).toEqual([]);
      });
    }
  }
}
