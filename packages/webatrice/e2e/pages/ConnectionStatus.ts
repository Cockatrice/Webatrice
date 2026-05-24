import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the global connection-status indicator rendered by
// `src/feature-wrappers/layout/LeftNav.tsx`. The red dot
// (`span.LeftNav-server__indicator`) is mounted iff `selectIsConnected`
// (Datatrice: `server.status.state === LOGGED_IN`) returns true; when
// connection drops the entire `.LeftNav-content` subtree is hidden along
// with the indicator. There is no dedicated reconnect banner today, so the
// indicator's visibility is the canonical "is the WebClient still
// LOGGED_IN" assertion surface for e2e.

export class ConnectionStatus {
  constructor(private readonly page: Page) {}

  get indicator(): Locator {
    return this.page.locator('span.LeftNav-server__indicator');
  }

  async expectConnected(timeoutMs = 5_000): Promise<void> {
    await expect(this.indicator).toBeVisible({ timeout: timeoutMs });
  }
}
