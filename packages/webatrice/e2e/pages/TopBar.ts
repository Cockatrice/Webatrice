import type { Locator, Page } from '@playwright/test';

export function topBarTab(page: Page, name?: string | RegExp): Locator {
  return page.getByRole('navigation', { name: /^open tabs$/i }).getByRole('link', name != null ? { name } : {});
}

export function navRailLink(page: Page, name: string | RegExp): Locator {
  return page.getByRole('navigation', { name: /^main navigation$/i }).getByRole('link', { name });
}

export function homeLink(page: Page): Locator {
  return page.getByRole('link', { name: /^webatrice home$/i });
}
