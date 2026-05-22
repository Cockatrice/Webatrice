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

export interface RegisteredSession {
  login: LoginPage;
  rooms: RoomsPage;
  user: ReturnType<typeof randomUser>;
}

// Register a fresh user, select the e2e docker host, and wait until the
// rooms list is visible. Stops at the rooms view — callers that need to
// be inside a room should use `registerAndJoinFirstRoom`.
export async function registerAndReachRooms(page: Page): Promise<RegisteredSession> {
  const login = new LoginPage(page);
  const rooms = new RoomsPage(page);
  const user = randomUser();

  await login.goto();
  await login.addHost(E2E_HOST_LABEL, E2E_HOST.host, E2E_HOST.port);
  await login.selectHost(E2E_HOST_LABEL);
  await login.register(user.username, user.password);
  await login.waitForRoomsView();
  await rooms.waitForRoomList();

  return { login, rooms, user };
}

// Builds on `registerAndReachRooms` and clicks the first joinable room
// (server seeds at least one). Picking the first row rather than naming
// the room avoids coupling to servatrice seed drift.
export async function registerAndJoinFirstRoom(page: Page): Promise<RegisteredSession> {
  const session = await registerAndReachRooms(page);

  const firstJoinable = page.getByRole('button', { name: /^join$/i }).first();
  await expect(firstJoinable).toBeVisible({ timeout: 15_000 });
  await firstJoinable.click();
  await session.rooms.waitForGameList();

  return session;
}
