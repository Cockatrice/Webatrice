import { expect, type Locator, type Page } from '@playwright/test';

export class ConnectionStatus {
  constructor(private readonly page: Page) {}

  get indicator(): Locator {
    return this.page.getByRole('status').filter({ hasText: /^connected$/i });
  }

  get latency(): Locator {
    return this.page.getByRole('button', { name: /^ping: \d+ ms$/i });
  }

  async expectConnected(timeoutMs = 5_000): Promise<void> {
    await expect(this.indicator).toBeVisible({ timeout: timeoutMs });
  }
}
