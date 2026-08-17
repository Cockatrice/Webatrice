import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the global connection-status indicator. The pre-redo
// LeftNav is gone; TopBar.tsx now renders a small lucide `<Circle>` next
// to the Webatrice logo whose `aria-label` flips between "Connected"
// (green) and "Disconnected" (red) off `selectIsConnected` (Datatrice:
// `server.status.state === LOGGED_IN`). Match by role+name so we don't
// depend on Tailwind class hashes.
export class ConnectionStatus {
  constructor(private readonly page: Page) {}

  get indicator(): Locator {
    return this.page.getByRole('img', { name: /^connected$/i });
  }

  async expectConnected(timeoutMs = 5_000): Promise<void> {
    await expect(this.indicator).toBeVisible({ timeout: timeoutMs });
  }
}
