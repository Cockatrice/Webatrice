import { expect, type Download, type Locator, type Page } from '@playwright/test';

export class ReplaysPage {
  constructor(private readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.getByRole('link', { name: /^replays$/i }).or(this.page.getByRole('button', { name: /^replays$/i })).first().click();
    await expect(this.list).toBeVisible();
  }

  get list(): Locator {
    return this.page.getByTestId('replay-list');
  }

  get detail(): Locator {
    return this.page.getByRole('region', { name: 'Replay details' });
  }

  matchRow(gameName: string): Locator {
    return this.list.locator('[data-testid^="replay-item-match:"]').filter({ hasText: gameName });
  }

  async selectMatch(gameName: string): Promise<Locator> {
    const row = this.matchRow(gameName);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.click();
    await expect(this.detail.getByRole('heading', { name: gameName })).toBeVisible();
    return row;
  }

  sourceFilter(name: 'All' | 'On the server' | 'On this device'): Locator {
    return this.page.getByRole('radio', { name });
  }

  detailAction(name: string): Locator {
    return this.detail.getByRole('button', { name, exact: true });
  }

  async downloadSelected(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.detailAction('Download').click(),
    ]);
    return download;
  }

  async loadPreview(): Promise<void> {
    await this.detail.getByRole('button', { name: /^(Download and preview|Read and preview)$/ }).click();
    await expect(this.preview).toBeVisible({ timeout: 30_000 });
  }

  get preview(): Locator {
    return this.page.getByTestId('replay-preview');
  }

  get previewTime(): Locator {
    return this.page.getByTestId('replay-preview-time');
  }

  get previewLog(): Locator {
    return this.page.getByTestId('replay-preview-log');
  }

  get watchFrom(): Locator {
    return this.detail.getByRole('button', { name: /^Watch from / });
  }

  get controls(): Locator {
    return this.page.getByTestId('replay-controls');
  }

  get time(): Locator {
    return this.page.getByTestId('replay-time');
  }

  get timeline(): Locator {
    return this.page.getByTestId('replay-timeline');
  }

  get log(): Locator {
    return this.page.getByTestId('right-panel');
  }

  async seekToFraction(fraction: number): Promise<void> {
    const box = await this.timeline.boundingBox();
    if (!box) {
      throw new Error('replay timeline is not rendered');
    }
    await this.timeline.click({ position: { x: Math.max(1, box.width * fraction), y: box.height / 2 } });
  }
}
