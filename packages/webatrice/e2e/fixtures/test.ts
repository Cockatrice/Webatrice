import { test as base, type BrowserContext, type BrowserContextOptions } from '@playwright/test';

import { isolateNetwork, type NetworkIsolation } from './network';

export { expect } from '@playwright/test';

// The `test` every e2e spec imports instead of `@playwright/test`'s.
//
// - `context` (and so `page`) is network-isolated; see `./network.ts`.
// - `newContext()` replaces `browser.newContext()` for multi-client specs: it
//   applies the same isolation (a raw `browser.newContext()` would bypass it)
//   and closes every context it made when the test ends, pass or fail. Specs
//   should not close them in a `finally`: closing before the failure is
//   recorded loses the page snapshot Playwright attaches to a failed test.

interface E2EFixtures {
  newContext: (options?: BrowserContextOptions) => Promise<BrowserContext>;
}

export const test = base.extend<E2EFixtures>({
  context: async ({ context }, use) => {
    const isolation = await isolateNetwork(context);
    await use(context);
    isolation.assertNoUnexpectedRequests();
  },

  newContext: async ({ browser }, use) => {
    const opened: { context: BrowserContext; isolation: NetworkIsolation }[] = [];

    await use(async (options) => {
      const context = await browser.newContext(options);
      opened.push({ context, isolation: await isolateNetwork(context) });
      return context;
    });

    for (const { context } of opened) {
      await context.close();
    }
    for (const { isolation } of opened) {
      isolation.assertNoUnexpectedRequests();
    }
  },
});
