// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi, type Mock } from 'vitest';

const origin = 'https://example.test';
const cacheName = 'webatrice:/Webatrice/:current';
const imageCacheName = 'webatrice:/Webatrice/:images';
const absolute = (value: Request | string) => new URL(typeof value === 'string' ? value : value.url, origin).href;
let handlers: Record<string, (event: any) => void>;
let stores: Map<string, Map<string, Response>>;
let network: Mock<typeof fetch>;
let skipWaiting: Mock<() => Promise<void>>;
let keyScans: Map<string, number>;

function imageResponse(type: ResponseType = 'cors', status = 200): Response {
  const response = new Response('image', { status });
  Object.defineProperty(response, 'type', { value: type });
  if (type === 'opaque') {
    Object.defineProperty(response, 'ok', { value: false });
    Object.defineProperty(response, 'status', { value: 0 });
  }
  Object.defineProperty(response, 'clone', { value: () => imageResponse(type, status) });
  return response;
}

function cache(name = cacheName) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const entries = stores.get(name)!;
  return {
    match: async (key: Request | string) => entries.get(absolute(key))?.clone(),
    put: async (key: Request | string, response: Response) => {
      entries.set(absolute(key), response.clone());
    },
    keys: async () => {
      keyScans.set(name, (keyScans.get(name) || 0) + 1);
      return [...entries.keys()].map((url) => new Request(url));
    },
    delete: async (key: Request | string) => entries.delete(absolute(key)),
    addAll: async (requests: Request[]) => {
      for (const request of requests) {
        await cache(name).put(request, await network(request));
      }
    },
  };
}

async function dispatch(type: string, properties = {}) {
  const pending: Promise<unknown>[] = [];
  let response: Promise<Response> | undefined;
  handlers[type]({ ...properties, waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    respondWith: (promise: Promise<Response>) => {
      response = promise;
    } });
  const result = await response;
  await Promise.all(pending);
  return result;
}

function get(url: string, options = {}) {
  return dispatch('fetch', { request: {
    url: new URL(url, origin).href, method: 'GET', mode: 'cors', destination: '', ...options,
  } });
}

beforeEach(async () => {
  handlers = {};
  stores = new Map();
  keyScans = new Map();
  network = vi.fn<typeof fetch>().mockImplementation(async () => new Response('fresh'));
  skipWaiting = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('addEventListener', (name: string, handler: (event: any) => void) => {
    handlers[name] = handler;
  });
  vi.stubGlobal('location', { origin });
  vi.stubGlobal('fetch', network);
  vi.stubGlobal('skipWaiting', skipWaiting);
  vi.stubGlobal('caches', {
    open: async (name: string) => cache(name), keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  });
  await loadWorker();
});

async function loadWorker(hash = 'current') {
  vi.resetModules();
  vi.stubGlobal('__SW_MANIFEST__', {
    base: '/Webatrice/', hash, bytes: 0,
    precache: [`${origin}/Webatrice/assets/app-12345678.js`],
    publicFiles: ['/Webatrice/locales/en.json'],
  });
  await import('./worker');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('precaches at install without taking over, then activates only when asked on a subsequent load', async () => {
  await dispatch('install');
  expect(await (await cache().match('/Webatrice/assets/app-12345678.js'))?.text()).toBe('fresh');
  expect(network.mock.calls[0][0]).toMatchObject({ cache: 'reload' });
  expect(skipWaiting).not.toHaveBeenCalled();
  await dispatch('message', { data: 'ACTIVATE_ON_LOAD' });
  expect(skipWaiting).toHaveBeenCalledOnce();
});

it('preserves cached images across a new build activation while deleting obsolete build caches', async () => {
  const nextCacheName = 'webatrice:/Webatrice/:next';
  for (const name of [cacheName, nextCacheName, `${cacheName}:images`, 'webatrice:/:other']) {
    cache(name);
  }
  await cache(imageCacheName).put('https://cards.scryfall.io/0.jpg', imageResponse());
  await loadWorker('next');
  await dispatch('activate');
  expect([...stores.keys()]).toEqual([nextCacheName, 'webatrice:/:other', imageCacheName]);
  expect(await (await get('https://cards.scryfall.io/0.jpg', { destination: 'image', mode: 'no-cors' }))?.text())
    .toBe('image');
  expect(network).not.toHaveBeenCalled();
});

it('serves hashed assets without network revalidation and fills runtime flag misses', async () => {
  await cache().put('/Webatrice/assets/app-12345678.js', new Response('cached'));
  expect(await (await get('/Webatrice/assets/app-12345678.js'))?.text()).toBe('cached');
  expect(network).not.toHaveBeenCalled();
  await get('/Webatrice/assets/us-12345678.svg');
  await get('/Webatrice/assets/us-12345678.svg');
  expect(network).toHaveBeenCalledOnce();
});

it('fetches fresh HTML on navigation and falls back to the canonical index offline or on server errors', async () => {
  await cache().put('/Webatrice/index.html', new Response('old'));
  expect(await (await get('/Webatrice/?invite=123', { mode: 'navigate' }))?.text()).toBe('fresh');
  expect(network.mock.calls[0][1]).toEqual({ cache: 'no-cache' });
  network.mockRejectedValueOnce(new Error('offline'));
  expect(await (await get('/Webatrice/decks', { mode: 'navigate' }))?.text()).toBe('fresh');
  network.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
  expect(await (await get('/Webatrice/', { mode: 'navigate' }))?.text()).toBe('fresh');
});

it('serves a cached locale immediately and refreshes it, preserving it when offline', async () => {
  await cache().put('/Webatrice/locales/en.json', new Response('cached'));
  expect(await (await get('/Webatrice/locales/en.json'))?.text()).toBe('cached');
  expect(await (await cache().match('/Webatrice/locales/en.json'))?.text()).toBe('fresh');
  network.mockRejectedValueOnce(new Error('offline'));
  expect(await (await get('/Webatrice/locales/en.json'))?.text()).toBe('fresh');
});

it('fetches no-cors images using credential-free CORS and caches their readable responses', async () => {
  network.mockImplementation(async () => imageResponse());
  const url = 'https://cards.scryfall.io/card.jpg';
  expect(await (await get(url, { destination: 'image', mode: 'no-cors' }))?.text()).toBe('image');
  expect(network.mock.calls[0][0]).toMatchObject({ url, mode: 'cors', credentials: 'omit' });
  expect(await (await get(url, { destination: 'image', mode: 'no-cors' }))?.text()).toBe('image');
  expect(network).toHaveBeenCalledOnce();
  expect((await cache(imageCacheName).match(url))?.type).toBe('cors');
});

it('returns the image before cache.put settles and keeps the background write alive', async () => {
  const url = 'https://cards.scryfall.io/card.jpg';
  const response = new Response('image');
  Object.defineProperty(response, 'type', { value: 'cors' });
  network.mockResolvedValueOnce(response);
  const images = cache(imageCacheName);
  let finishWrite: () => void;
  const blockedWrite = new Promise<void>((resolve) => {
    finishWrite = resolve;
  });
  const put = vi.fn(async (key: Request | string, value: Response) => {
    await blockedWrite;
    await images.put(key, value);
  });
  vi.spyOn(caches, 'open').mockResolvedValue({ ...images, put } as unknown as Cache);
  const pending: Promise<unknown>[] = [];
  const waitUntil = vi.fn((promise: Promise<unknown>) => {
    pending.push(promise);
  });
  let responsePromise: Promise<Response>;
  handlers.fetch({
    request: { url, method: 'GET', destination: 'image', mode: 'no-cors' },
    waitUntil,
    respondWith: (promise: Promise<Response>) => {
      responsePromise = promise;
    },
  });
  let delivered: Response;
  const delivery = responsePromise.then((result) => {
    delivered = result;
  });
  try {
    await vi.waitFor(() => expect(delivered).toBe(response));
    expect(await delivered.text()).toBe('image');
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    expect(stores.get(imageCacheName)?.size).toBe(0);
    let workFinished = false;
    const work = Promise.all(pending).then(() => {
      workFinished = true;
    });
    await Promise.resolve();
    expect(workFinished).toBe(false);
    finishWrite();
    await work;
    expect(await (await images.match(url))?.text()).toBe('image');
  } finally {
    finishWrite();
    await delivery;
    await Promise.all(pending);
  }
});

it.each(['opaque', 'cors'] as const)('returns an uncached %s fallback when the CORS fetch throws', async (type) => {
  const fallback = imageResponse(type);
  network.mockRejectedValueOnce(new TypeError('CORS denied')).mockResolvedValueOnce(fallback);
  const request = { url: 'https://cards.scryfall.io/card.jpg', method: 'GET', destination: 'image', mode: 'no-cors' };
  expect(await dispatch('fetch', { request })).toBe(fallback);
  expect(network.mock.calls[1]).toEqual([request]);
  expect(stores.get(imageCacheName)?.size).toBe(0);
  expect(keyScans.get(imageCacheName)).toBeUndefined();
});

it.each([['opaque', 200], ['basic', 200], ['cors', 404]] as const)(
  'does not cache a %s image response with status %s', async (type, status) => {
    network.mockResolvedValueOnce(imageResponse(type, status));
    await get('https://cards.scryfall.io/card.jpg', { destination: 'image', mode: 'no-cors' });
    expect(stores.get(imageCacheName)?.size).toBe(0);
  });

it('never stores opaque responses in the public or asset cache', async () => {
  network.mockImplementation(async () => imageResponse('opaque'));
  await get('/Webatrice/locales/en.json');
  await get('/Webatrice/assets/us-12345678.svg');
  expect(stores.get(cacheName)?.size).toBe(0);
});

it('caps concurrent image writes at 1000 and evicts the oldest cached images', async () => {
  network.mockImplementation(async () => imageResponse());
  const images = cache(imageCacheName);
  for (let index = 0; index < 1000; index++) {
    await images.put(`https://cards.scryfall.io/${index}.jpg`, imageResponse());
  }
  await Promise.all([1000, 1001].map((index) => get(`https://cards.scryfall.io/${index}.jpg`, { destination: 'image' })));
  expect(stores.get(imageCacheName)?.size).toBe(1000);
  expect(await images.match('https://cards.scryfall.io/0.jpg')).toBeUndefined();
  expect(await images.match('https://cards.scryfall.io/1.jpg')).toBeUndefined();
  await get('https://cards.scryfall.io/1000.jpg', { destination: 'image' });
  expect(network).toHaveBeenCalledTimes(2);
});

it('counts persisted entries once after restart, then scans every 50 writes below the cap', async () => {
  network.mockImplementation(async () => imageResponse());
  for (let index = 0; index < 49; index++) {
    await get(`https://cards.scryfall.io/${index}.jpg`, { destination: 'image' });
  }
  expect(keyScans.get(imageCacheName)).toBe(1);
  await get('https://cards.scryfall.io/49.jpg', { destination: 'image' });
  expect(keyScans.get(imageCacheName)).toBe(2);
  await loadWorker();
  await get('https://cards.scryfall.io/50.jpg', { destination: 'image' });
  expect(keyScans.get(imageCacheName)).toBe(3);
  expect(stores.get(imageCacheName)?.size).toBe(51);
});

it('bypasses APIs and disabled workers, including after a kill switch message', async () => {
  expect(await get('https://api.scryfall.com/cards/random')).toBeUndefined();
  expect(await get('/Webatrice/?sw-disable', { mode: 'navigate' })).toBeUndefined();
  await cache().put('/Webatrice/assets/app-12345678.js', new Response('cached'));
  await cache(imageCacheName).put('https://cards.scryfall.io/0.jpg', imageResponse());
  await dispatch('message', { data: 'DISABLE', ports: [] });
  expect([...stores.keys()]).toEqual([]);
  expect(await get('/Webatrice/assets/app-12345678.js')).toBeUndefined();
  expect(network).not.toHaveBeenCalled();
});
