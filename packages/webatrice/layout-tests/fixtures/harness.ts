import type { Page, Route } from '@playwright/test';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const escapeXml = (text: string) => text.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

function cardSvg(name: string): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680" viewBox="0 0 488 680">'
    + '<rect width="488" height="680" rx="24" fill="#3b3b4f"/>'
    + '<rect x="20" y="20" width="448" height="640" rx="12" fill="none" stroke="#8a8aa3" stroke-width="4"/>'
    + `<text x="40" y="84" font-size="40" font-family="sans-serif" fill="#ffffff">${escapeXml(name)}</text>`
    + '</svg>';
}

async function stubExternal(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  const isImage = url.searchParams.get('format') === 'image' || url.hostname.endsWith('scryfall.io');
  if (isImage) {
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      headers: { 'access-control-allow-origin': '*' },
      body: cardSvg(url.searchParams.get('exact') ?? 'Card'),
    });
    return;
  }
  await route.abort();
}

export interface HarnessOptions {
  players?: number;
  as?: 'player' | 'spectator';
  route?: 'game' | 'home' | 'room' | 'deck';
  previewMode?: 'image' | 'text' | 'both';
}

export async function openHarness(page: Page, options: HarnessOptions = {}): Promise<void> {
  const { players = 4, as = 'player', route = 'game', previewMode = 'image' } = options;
  await page.route((url) => !LOCAL_HOSTS.has(url.hostname), stubExternal);
  await page.addInitScript((mode) => {
    window.localStorage.setItem('webatrice.cardPreviewMode', mode);
  }, previewMode);
  await page.goto(`/layout-tests/harness.html?players=${players}&as=${as}&route=${route}`);
  if (route === 'game') {
    await page.locator('[data-battlefield-owner]').first().waitFor({ timeout: 90_000 });
  } else {
    await page.locator('#root nav, #root main').first().waitFor({ timeout: 90_000 });
  }
  await settle(page);
}

export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.waitForTimeout(250);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

export async function openChats(page: Page, open: number, minimised = 0): Promise<void> {
  await page.evaluate(([o, m]) => window.layoutHarness.openChats(o, m), [open, minimised] as const);
  await settle(page);
}

export async function closeChats(page: Page): Promise<void> {
  await page.evaluate(() => window.layoutHarness.closeChats());
  await settle(page);
}

export async function showCardInPreview(page: Page): Promise<void> {
  const card = page.locator('[data-battlefield-owner] [data-card]').first();
  await card.hover();
  await page.waitForTimeout(150);
  await page.mouse.move(2, 2);
  await page.waitForTimeout(600);
  await settle(page);
}

declare global {
  interface Window {
    layoutHarness: { openChats: (open: number, minimised?: number) => void; closeChats: () => void; say: (message: string) => void };
  }
}
