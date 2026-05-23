// Expected-state sanity primitives for flow specs. We don't introspect
// the live redux store from Playwright; these are exported instead as
// the small set of structural assertions e2e specs use against the DOM
// (room name, default room id, server message snippet, etc.) and a few
// composed shapes pulled from `@cockatrice/datatrice/testing` for any
// future spec that does pop the store hatch via `window.__REDUX_STORE__`.
//
// Keep this file thin: most spec-level assertions live in the spec.

import { makeRoom, makeUser } from '@cockatrice/datatrice/testing';

export const DEFAULT_ROOM_NAME = 'Magic - General';

export const EXPECTED_FIRST_ROOM = makeRoom({
  roomId: 1,
  name: DEFAULT_ROOM_NAME,
});

export function expectedUserShape(name: string) {
  return makeUser({ name });
}

// Servatrice's default welcome message includes the substring "welcome";
// specs use this for a loose containment check instead of exact equality.
export const SERVER_MESSAGE_MARKER = /welcome/i;
