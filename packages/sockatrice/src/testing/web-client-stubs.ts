// Minimal in-repo stub for the IWebClientResponse interface that WebClient is
// constructed with. The real Redux-dispatching implementation lives in the
// downstream app (Webatrice); here we hand WebClient a Proxy-backed stub
// whose every property is a fresh `vi.fn()`. Tests assert against these
// spies instead of Redux state.
//
// Per [[project_sockatrice-app-boundary]] the request facade lives outside
// Sockatrice, so only the response side is mocked here.

import { vi } from 'vitest';
import type { IWebClientResponse } from '../types/WebClientResponse';
import type { ISessionResponse, IRoomResponse, IGameResponse, IAdminResponse, IModeratorResponse } from '../types/WebClientResponse';

type AnyFn = (...args: unknown[]) => unknown;

function makeSpyBag<T extends object>(): T {
  const bag: Record<string | symbol, AnyFn> = {};
  return new Proxy({} as T, {
    get(_, prop) {
      if (typeof prop === 'symbol') {
        return undefined;
      }
      if (!(prop in bag)) {
        bag[prop] = vi.fn();
      }
      return bag[prop];
    },
    has() {
      return true;
    },
  });
}

export interface MockWebClientResponse extends IWebClientResponse {
  session: ReturnType<typeof makeSpyBag<ISessionResponse>>;
  room: ReturnType<typeof makeSpyBag<IRoomResponse>>;
  game: ReturnType<typeof makeSpyBag<IGameResponse>>;
  admin: ReturnType<typeof makeSpyBag<IAdminResponse>>;
  moderator: ReturnType<typeof makeSpyBag<IModeratorResponse>>;
}

export function createMockWebClientResponse(): MockWebClientResponse {
  return {
    session: makeSpyBag<ISessionResponse>(),
    room: makeSpyBag<IRoomResponse>(),
    game: makeSpyBag<IGameResponse>(),
    admin: makeSpyBag<IAdminResponse>(),
    moderator: makeSpyBag<IModeratorResponse>(),
  };
}
