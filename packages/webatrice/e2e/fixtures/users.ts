import { randomBytes } from 'node:crypto';

// Per-test-run unique user generator. Servatrice enforces unique
// usernames; parallel CI re-runs would collide on a static `e2e_user`,
// hence the 8-hex-char suffix. Matches the convention introduced in
// `e2e/specs/login-join-room.spec.ts`.
//
// Passwords are not randomised — the default `password123` satisfies the
// e2e servatrice.ini's minimum-length policy and keeps logs greppable.

export interface E2EUser {
  username: string;
  password: string;
}

export function randomSuffix(): string {
  return randomBytes(4).toString('hex');
}

export function randomUser(): E2EUser {
  return {
    username: `e2e_${randomSuffix()}`,
    password: 'password123',
  };
}
