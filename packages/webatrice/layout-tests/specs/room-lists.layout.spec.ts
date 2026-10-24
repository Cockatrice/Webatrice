import { expect, test } from '@playwright/test';
import { openHarness, settle } from '../fixtures/harness';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openHarness(page, { route: 'room' });
  await expect(page.getByRole('log')).toBeVisible();
});

test('chat keeps its log name, wrapped links, and scrolls down on arrival even from history', async ({ page }) => {
  const log = page.getByRole('log');
  await expect(log).toHaveAttribute('aria-label', /.+/);
  await expect(log).toHaveAttribute('tabindex', '0');
  await expect(log.getByRole('link', { name: 'https://example.com/319' })).toHaveAttribute('href', 'https://example.com/319');
  await expect(log.getByRole('link', { name: '@person1' }).last()).toHaveAttribute('href', /person1/);
  await log.evaluate((element) => {
    element.scrollTop = 0;
  });
  await settle(page);
  await page.evaluate(() => window.layoutHarness.say('arrival with a long line '.repeat(30)));
  await settle(page);
  await expect.poll(() => log.evaluate((element) => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(2);
  const last = log.locator('.message').last();
  const bounds = await last.boundingBox();
  expect(bounds!.height).toBeGreaterThan(40);
});

test('entering the log with Tab still reaches the first transcript link', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit leaves links out of the Tab order by default');
  const log = page.getByRole('log');
  await log.focus();
  await page.keyboard.press('Tab');
  await expect(log.getByRole('link', { name: 'speaker0', exact: true })).toBeFocused();
});

test('copies text across wrapped rows in the viewport and a screen either side', async ({ page }) => {
  const log = page.getByRole('log');
  await log.evaluate((element) => {
    element.scrollTop = element.scrollHeight / 2;
  });
  await settle(page);
  const selected = await log.evaluate((element) => {
    const viewport = element.getBoundingClientRect();
    const rows = Array.from(element.querySelectorAll('.message')).filter((row) => {
      const bounds = row.getBoundingClientRect();
      return bounds.bottom > viewport.top - viewport.height && bounds.top < viewport.bottom + viewport.height;
    });
    const range = document.createRange();
    range.setStartBefore(rows[0]);
    range.setEndAfter(rows[rows.length - 1]);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return { text: selection.toString(), count: rows.length };
  });
  expect(selected.count).toBeGreaterThan(2);
  const copied = page.evaluate(() => new Promise<string>((resolve) => {
    document.addEventListener('copy', () => resolve(window.getSelection()!.toString()), { once: true });
  }));
  await page.keyboard.press('ControlOrMeta+c');
  expect((await copied).replace(/\r\n/g, '\n')).toBe(selected.text.replace(/\r\n/g, '\n'));
});

test('room users stay a named, bounded list with working section controls', async ({ page }) => {
  const list = page.getByRole('list', { name: /People in/ });
  await expect(list).toBeVisible();
  const preview = list.getByRole('button').filter({ hasText: /more/i });
  await preview.click();
  expect(await list.getByRole('listitem').count()).toBeLessThan(100);
  await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-setsize', '406');
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await settle(page);
  await expect(list.getByRole('link', { name: 'person99', exact: true })).toBeVisible();
});


