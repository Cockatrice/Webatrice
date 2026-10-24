import { execFileSync } from 'node:child_process';

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures/test';
import { E2E_ADMIN, E2E_MODERATOR, reachRoomsAs, registerAndReachRooms, openAdministrationUnlocked } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';
import { homeLink, navRailLink } from '../pages';

// Staff pages against the real Servatrice: the Administration tab's "Update
// server message" (desktop TabAdmin) and the Moderation tab's alts lookup
// (desktop TabModeration, Cockatrice 3.1 only). The seeded staff accounts come
// from docker/servatrice/judge-seed.sql.
//
// Alts and sessions need a 3.1 server. Run against Cockatrice master with
//   SERVATRICE_IMAGE=webatrice-local/servatrice:master-add65ca npm run test:e2e
// Against the pinned 3.0 release the specs check the 3.0 parts of the staff tools.
// global-setup decodes Event_ServerIdentification, independently of the UI and image tag.
const ADVERTISED_VERSION = process.env.SERVATRICE_ADVERTISED_VERSION;

function runSql(sql: string): void {
  execFileSync('docker', [
    'compose', '--env-file', '../../.env.e2e', '--env-file', '.env.e2e',
    '-f', '../../docker/servatrice/docker-compose.e2e.yml',
    'exec', '-T', 'mysql', 'mysql', '-uservatrice', '-ppassword', 'servatrice', '-e', sql,
  ], { stdio: 'pipe' });
}

async function openUserMenu(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: userName, exact: true }).click();
}

test('an admin publishes a new server message from Administration', async ({ page }) => {
  test.setTimeout(90_000);
  await reachRoomsAs(page, E2E_ADMIN);

  const message = `E2E server message ${randomSuffix()}`;
  runSql(`INSERT INTO cockatrice_servermessages (id_server, timest, message) VALUES (0, NOW() + INTERVAL 1 SECOND, '${message}')`);

  await openAdministrationUnlocked(page, E2E_ADMIN.username);
  await page.getByRole('button', { name: /^Update server message/ }).click();
  await expect(page.getByText('Server message updated')).toBeVisible({ timeout: 15_000 });

  await homeLink(page).click();
  await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });
});

async function speaksModerationTools(): Promise<boolean> {
  expect(ADVERTISED_VERSION, 'global setup must capture the advertised server version').toBeTruthy();
  const { server, ServerCapability } = await import('@cockatrice/datatrice');
  return server.serverSupports(ADVERTISED_VERSION ?? null, ServerCapability.MODERATION_TOOLS);
}

test('staff reach every tool the server serves from the Staff place in the rail', async ({ page }) => {
  test.setTimeout(90_000);
  const v31 = await speaksModerationTools();
  await reachRoomsAs(page, E2E_MODERATOR);

  await navRailLink(page, /^staff/i).click();
  await expect(navRailLink(page, /^staff/i)).toHaveAttribute('aria-current', 'page');

  const tools = page.getByRole('navigation', { name: 'Staff tools' });
  const served = v31
    ? ['Reports', 'Moderation', 'Logs', 'Administration', 'Card art rules']
    : ['Moderation', 'Logs', 'Administration'];
  await expect(tools.getByRole('link')).toHaveText(served);
  await expect(tools.getByText('Needs server 3.1')).toHaveCount(v31 ? 0 : 2);
  await expect(tools.getByRole('link').first()).toHaveAttribute('aria-current', 'page');

  for (const name of served) {
    const link = tools.getByRole('link', { name, exact: true });
    await link.click();
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('a regular user has no Staff place and no staff tools', async ({ page }) => {
  test.setTimeout(60_000);
  const { user } = await registerAndReachRooms(page);

  await expect(navRailLink(page, /^settings$/i)).toBeVisible();
  await expect(navRailLink(page, /^staff/i)).toHaveCount(0);
  await openUserMenu(page, user.username);
  await expect(page.getByRole('group', { name: 'Staff tools' })).toHaveCount(0);
});

test('a moderator investigates an account from Moderation', async ({ newContext, page }) => {
  test.setTimeout(120_000);
  const v31 = await speaksModerationTools();

  const suspectContext = await newContext();
  const suspectPage = await suspectContext.newPage();
  const { user: suspect } = await registerAndReachRooms(suspectPage);

  await reachRoomsAs(page, E2E_MODERATOR);
  await openUserMenu(page, E2E_MODERATOR.username);
  await page.getByRole('menuitem', { name: 'Moderation', exact: true }).click();
  await page.getByRole('searchbox', { name: 'User name' }).fill(suspect.username);
  await page.getByRole('button', { name: 'Investigate' }).click();

  const info = page.getByRole('region', { name: 'User Info' });
  if (!v31) {
    test.info().annotations.push({
      type: 'unsupported',
      description: `Alts and sessions need 3.1; advertised server ${ADVERTISED_VERSION} gets the 3.0 lookup`,
    });
    await expect(info.getByText('Registered user')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Alts' }).getByText('Needs server 3.1.')).toBeVisible();
    await page.getByRole('button', { name: 'Warn history' }).click();
    await expect(page.getByRole('dialog', { name: 'Warning History' })).toBeVisible({ timeout: 15_000 });
    return;
  }

  const alts = page.getByRole('region', { name: 'Alts' });
  await expect(alts.getByRole('cell', { name: suspect.username, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(info.getByText('active', { exact: true })).toBeVisible();
});
