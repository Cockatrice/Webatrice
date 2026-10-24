import { expect, test, type Page } from '@playwright/test';

import { boardReport, dockReport, dockViolations, previewReport, previewViolations } from '../fixtures/geometry';
import { closeChats, openChats, openHarness, settle, showCardInPreview } from '../fixtures/harness';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2000, height: 1125 },
];
const PLAYER_COUNTS = [2, 3, 4, 6];
const SEATS = ['player', 'spectator'] as const;
const PREVIEW = ['empty', 'showing a card'] as const;

for (const players of PLAYER_COUNTS) {
  for (const as of SEATS) {
    for (const preview of PREVIEW) {
      test(`${players} players, as ${as}, preview ${preview}: every seat fits its pane`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[0]);
        await openHarness(page, { players, as, previewMode: preview === 'empty' ? 'image' : 'both' });
        if (preview !== 'empty') {
          await showCardInPreview(page);
        }
        const failures: string[] = [];
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          await settle(page);
          const report = await boardReport(page);
          expect(report.seats, `${viewport.width}x${viewport.height} seats`).toBe(players);
          expect(report.cards, `${viewport.width}x${viewport.height} cards`).toBeGreaterThan(players * 15);
          failures.push(...report.violations.map((v) => `${viewport.width}x${viewport.height}: ${v}`));
          failures.push(...previewViolations(await previewReport(page)).map((v) => `${viewport.width}x${viewport.height}: ${v}`));
          if (players >= 4) {
            const columns = report.seatSummaries.map((seat) => seat.columns);
            expect(columns.some((n) => n >= 8), 'a seat with eight or more columns').toBe(true);
            expect(columns.some((n) => n === 7), 'a seat with exactly seven columns').toBe(true);
          }
        }
        expect(failures).toEqual([]);
      });
    }
  }
}

const SIDEBAR_STATES = ['default', 'widest', 'collapsed'] as const;

async function setSidebar(page: Page, state: (typeof SIDEBAR_STATES)[number]): Promise<void> {
  if (state === 'widest') {
    await page.getByRole('separator', { name: 'Resize sidebar' }).focus();
    await page.keyboard.press('Home');
  } else if (state === 'collapsed') {
    await page.getByRole('button', { name: 'Collapse the dock' }).click();
  }
  await settle(page);
}

for (const as of SEATS) {
  for (const sidebar of SIDEBAR_STATES) {
    const title = `as ${as}, sidebar ${sidebar}: the chat dock sits on the bottom edge beside the sidebar without hiding tray controls`;
    test(title, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[0]);
      await openHarness(page, { players: 4, as, previewMode: 'both' });
      await setSidebar(page, sidebar);
      const failures: string[] = [];
      for (const chats of [{ open: 1, minimised: 0 }, { open: 1, minimised: 1 }, { open: 3, minimised: 1 }]) {
        await openChats(page, chats.open, chats.minimised);
        for (const preview of PREVIEW) {
          if (preview !== 'empty') {
            await showCardInPreview(page);
          }
          for (const viewport of VIEWPORTS) {
            await page.setViewportSize(viewport);
            await settle(page);
            const report = await dockReport(page);
            const where = `${viewport.width}x${viewport.height}, ${chats.open}+${chats.minimised} chats, preview ${preview}`;
            if (!report.items.some((item) => item.kind === 'window')) {
              failures.push(`${where}: no chat window`);
            }
            if (!report.sidebar) {
              failures.push(`${where}: no game sidebar`);
            }
            failures.push(...dockViolations(report).map((v) => `${where}: ${v}`));
          }
        }
        await page.setViewportSize(VIEWPORTS[0]);
        await closeChats(page);
      }
      expect(failures).toEqual([]);
    });
  }
}
