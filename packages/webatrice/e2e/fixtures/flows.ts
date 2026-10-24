import { expect, type Page } from '@playwright/test';

import { LoginPage, RoomsPage } from '../pages';
import { randomUser } from './users';

// Shared e2e prologue fragments. Every spec except `app-boots.spec.ts`
// needs to register a fresh user against the docker Servatrice and land
// somewhere — either the rooms view or inside a specific room. These
// helpers own that choreography so each spec asserts only its unique
// behavior.

export const E2E_HOST_LABEL = 'e2e';
export const E2E_HOST = { host: 'localhost', port: 4748 } as const;

// Pre-seeded judge account (docker/servatrice/judge-seed.sql, admin = 4 → IsJudge).
// Used by the judge-card-actions e2e to log in as a judge.
export const E2E_JUDGE = { username: 'e2e_judge', password: 'password123' } as const;
export const E2E_MODERATOR = { username: 'e2e_moderator', password: 'password123' } as const;
export const E2E_ADMIN = { username: 'e2e_superuser', password: 'password123' } as const;

export interface RegisteredSession {
  login: LoginPage;
  rooms: RoomsPage;
  user: ReturnType<typeof randomUser>;
}

// Select the e2e docker host on the login screen (shared by register + login).
async function reachHost(login: LoginPage): Promise<void> {
  await login.goto();
  await login.addHost(E2E_HOST_LABEL, E2E_HOST.host, E2E_HOST.port);
  await login.selectHost(E2E_HOST_LABEL);
}

// Click the first joinable room (server seeds at least one). Picking the first
// room rather than naming it avoids coupling to servatrice seed drift; two
// sessions both calling this land in the same room.
//
// The e2e Servatrice auto-joins its one room on login. Like desktop
// (setCurrent = false), the auto-join opens the room without leaving Home,
// so the Rooms panel's button reads "Join <room>" or "Open <room>" and the
// click is what enters the room — the manual path is exercised on every run.
export async function joinFirstRoom(page: Page, rooms: RoomsPage): Promise<void> {
  const firstJoinable = rooms.roomsPanel
    .getByRole('button', { name: /^(join|open) /i })
    .first();
  await expect(firstJoinable).toBeVisible({ timeout: 15_000 });
  await firstJoinable.click();
  await rooms.waitForGameList();
}

// Register a fresh user, select the e2e docker host, and wait until the
// rooms list is visible. Stops at the rooms view — callers that need to
// be inside a room should use `registerAndJoinFirstRoom`.
export async function registerAndReachRooms(page: Page): Promise<RegisteredSession> {
  const login = new LoginPage(page);
  const rooms = new RoomsPage(page);
  const user = randomUser();

  await reachHost(login);
  // Register against the e2e docker host — the RegisterForm mounts its
  // own KnownHosts and defaults `selectedHost` to undefined, so without
  // passing this label the dialog would pick the first entry
  // (Rooster, seeded by the app) and register against the public
  // server instead of our local Servatrice.
  await login.register(user.username, user.password, { hostLabel: E2E_HOST_LABEL });
  await rooms.waitForRoomList();

  return { login, rooms, user };
}

// Log in as an existing (pre-seeded) account and wait for the rooms list —
// e.g. the seeded judge. Auto-registration is a no-op for an existing user.
export async function reachRoomsAs(
  page: Page,
  credentials: { username: string; password: string },
): Promise<{ login: LoginPage; rooms: RoomsPage }> {
  const login = new LoginPage(page);
  const rooms = new RoomsPage(page);

  await reachHost(login);
  await login.login(credentials.username, credentials.password);
  await rooms.waitForRoomList();

  return { login, rooms };
}

// Builds on `registerAndReachRooms` and joins the first room.
export async function registerAndJoinFirstRoom(page: Page): Promise<RegisteredSession> {
  const session = await registerAndReachRooms(page);
  await joinFirstRoom(page, session.rooms);
  return session;
}

export async function openAdministrationUnlocked(page: Page, userName: string): Promise<void> {
  await page.getByRole('button', { name: userName, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Administration', exact: true }).click();
  await expect(page.getByRole('main').getByRole('button', { name: 'Lock functions' }).first()).toBeVisible();
}

// Log in as an existing account and join the first room (for the seeded
// judge and staff).
export async function joinFirstRoomAs(
  page: Page,
  credentials: { username: string; password: string },
): Promise<{ login: LoginPage; rooms: RoomsPage }> {
  const session = await reachRoomsAs(page, credentials);
  await joinFirstRoom(page, session.rooms);
  return session;
}
