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
// row rather than naming the room avoids coupling to servatrice seed drift; two
// sessions both calling this land in the same room.
async function joinFirstRoom(page: Page, rooms: RoomsPage): Promise<void> {
  const firstJoinable = page.locator('.rooms').getByRole('button', { name: /^join$/i }).first();
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
  await login.register(user.username, user.password);
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

// Log in as an existing account and join the first room (for the seeded judge).
export async function joinFirstRoomAs(
  page: Page,
  credentials: { username: string; password: string },
): Promise<{ login: LoginPage; rooms: RoomsPage }> {
  const session = await reachRoomsAs(page, credentials);
  await joinFirstRoom(page, session.rooms);
  return session;
}
