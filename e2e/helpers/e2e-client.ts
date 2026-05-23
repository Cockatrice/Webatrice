import { vi } from 'vitest';
import { randomBytes } from 'node:crypto';

// E2e specs and helpers import from the built `dist/` so the suite exercises
// the artifact consumers actually pull. `dist/index.js` and
// `dist/types/index.js` are tsup entries; `WebsocketTypes` is the public
// namespace (StatusEnum, IWebClientResponse, ClientConfig, etc.). Deep
// imports into `src/types/*` are deliberately avoided — they aren't part
// of the published surface, and an alias-to-dist couldn't resolve them
// anyway.
import { WebClient } from '../../dist/index.js';
import { WebsocketTypes } from '../../dist/types/index.js';

const CLIENT_CONFIG: WebsocketTypes.ClientConfig = {
  clientid: 'sockatrice-e2e',
  clientver: 'sockatrice-e2e (test)',
  clientfeatures: [
    'client_id',
    'client_ver',
    'feature_set',
    'room_chat_history',
    'client_warnings',
    'forgot_password',
    'idle_client',
    'mod_log_lookup',
    'user_ban_history',
    'websocket',
    '2.7.0_min_version',
    '2.8.0_min_version',
  ],
};

const CLIENT_OPTIONS: WebsocketTypes.ClientOptions = {
  autojoinrooms: true,
  keepalive: 5000,
};

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

export type E2EWebClientResponse = {
  [K in keyof WebsocketTypes.IWebClientResponse]: WebsocketTypes.IWebClientResponse[K];
};

export function createE2EResponse(): E2EWebClientResponse {
  return {
    session: makeSpyBag<WebsocketTypes.IWebClientResponse['session']>(),
    room: makeSpyBag<WebsocketTypes.IWebClientResponse['room']>(),
    game: makeSpyBag<WebsocketTypes.IWebClientResponse['game']>(),
    admin: makeSpyBag<WebsocketTypes.IWebClientResponse['admin']>(),
    moderator: makeSpyBag<WebsocketTypes.IWebClientResponse['moderator']>(),
  };
}

export interface E2EClient {
  webClient: WebClient;
  response: E2EWebClientResponse;
}

export function createE2EClient(): E2EClient {
  const response = createE2EResponse();
  const webClient = new WebClient(response, CLIENT_CONFIG, CLIENT_OPTIONS);
  return { webClient, response };
}

export function resetE2EClient(): void {
  const instance = (WebClient as unknown as { _instance: WebClient | null })._instance;
  if (instance) {
    try {
      instance.disconnect();
    } catch {
      // ignore — socket may already be closed
    }
    instance.protobuf.resetCommands();
    instance.status = WebsocketTypes.StatusEnum.DISCONNECTED;
  }
  (WebClient as unknown as { _instance: WebClient | null })._instance = null;
}

export interface UniqueUser {
  userName: string;
  password: string;
  email: string;
}

// servatrice-e2e.ini accepts usernames 4-12 chars from [a-zA-Z0-9_.-];
// 'e2e' + 8 lowercase-hex chars = 11 chars, well inside the limit.
export function generateUniqueUser(): UniqueUser {
  const suffix = randomBytes(4).toString('hex');
  return {
    userName: `e2e${suffix}`,
    password: 'sockatrice-e2e',
    email: '',
  };
}

export async function waitForStatus(
  target: WebsocketTypes.StatusEnum,
  timeoutMs: number,
  intervalMs = 50,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (WebClient.instance.status === target) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for status ${WebsocketTypes.StatusEnum[target]}; ` +
      `last seen ${WebsocketTypes.StatusEnum[WebClient.instance.status]}.`,
  );
}
