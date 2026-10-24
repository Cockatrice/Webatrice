import { cachePrefix, oldestEntries, routeRequest, type WorkerManifest } from './policy';

interface LifetimeEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface WorkerFetchEvent extends LifetimeEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerEvents {
  install: LifetimeEvent;
  activate: LifetimeEvent;
  fetch: WorkerFetchEvent;
  message: LifetimeEvent & { data: unknown; ports: readonly MessagePort[] };
}

declare const __SW_MANIFEST__: WorkerManifest;
const worker = globalThis as unknown as {
  location: Location;
  skipWaiting(): Promise<void>;
  addEventListener<K extends keyof WorkerEvents>(type: K, listener: (event: WorkerEvents[K]) => void): void;
};
const manifest = __SW_MANIFEST__;
const prefix = cachePrefix(manifest.base);
const cacheName = `${prefix}${manifest.hash}`;
const imageCacheName = `${prefix}images`;
const imageCap = 1000;
let disabled = false;
let imageWrites = Promise.resolve();
let imageEntryCount: number | undefined;
let imageWriteCount = 0;

worker.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(manifest.precache.map((url) => new Request(url, { cache: 'reload' })));
  })());
});

worker.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys())
      .filter((name) => name.startsWith(prefix) && name !== cacheName && name !== imageCacheName)
      .map((name) => caches.delete(name)));
  })());
});

worker.addEventListener('message', (event) => {
  if (event.data === 'ACTIVATE_ON_LOAD') {
    event.waitUntil(worker.skipWaiting());
  }
  if (event.data === 'DISABLE') {
    disabled = true;
    event.waitUntil((async () => {
      await imageWrites;
      await Promise.all((await caches.keys()).filter((name) => name.startsWith(prefix))
        .map((name) => caches.delete(name)));
      event.ports[0]?.postMessage('DISABLED');
    })());
  }
});

async function remember(cache: Cache, request: Request | string, response: Response) {
  if (disabled || !response.ok || response.type === 'opaque') {
    return false;
  }
  try {
    await cache.put(request, response.clone());
    return true;
  } catch {
    // Storage pressure must not turn a successful network response into a failed request.
    return false;
  }
}

async function documentResponse(request: Request) {
  const cache = await caches.open(cacheName);
  const index = `${manifest.base}index.html`;
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) {
      await remember(cache, index, response);
      return response;
    }
    return await cache.match(index) || response;
  } catch (error) {
    const cached = await cache.match(index);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function imageResponse(cache: Cache, event: WorkerFetchEvent) {
  const request = event.request;
  let response: Response;
  try {
    response = await fetch(new Request(request.url, { mode: 'cors', credentials: 'omit' }));
  } catch {
    return fetch(request);
  }
  if (!response.ok || response.type !== 'cors') {
    return response;
  }
  const cacheResponse = response.clone();
  imageWrites = imageWrites.then(async () => {
    const existing = await cache.match(request);
    if (!await remember(cache, request, cacheResponse)) {
      return;
    }
    imageWriteCount++;
    if (imageEntryCount !== undefined && !existing) {
      imageEntryCount++;
    }
    if (imageEntryCount === undefined || imageWriteCount % 50 === 0 || imageEntryCount > imageCap) {
      const keys = await cache.keys();
      const deleted = await Promise.all(oldestEntries(keys, imageCap).map((key) => cache.delete(key)));
      imageEntryCount = keys.length - deleted.filter(Boolean).length;
    }
  }).catch(() => undefined);
  event.waitUntil(imageWrites);
  return response;
}

async function cachedResponse(event: WorkerFetchEvent, route: 'asset' | 'public' | 'image') {
  const request = event.request;
  const cache = await caches.open(route === 'image' ? imageCacheName : cacheName);
  const cached = await cache.match(request);
  if (cached && route !== 'public') {
    return cached;
  }
  const fresh = route === 'image' ? imageResponse(cache, event)
    : fetch(request, route === 'public' ? { cache: 'no-cache' } : undefined)
      .then(async (response) => {
        await remember(cache, request, response);
        return response;
      });
  event.waitUntil(fresh.catch(() => undefined));
  return cached || fresh;
}

worker.addEventListener('fetch', (event) => {
  if (disabled) {
    return;
  }
  const route = routeRequest(event.request, worker.location.origin, manifest);
  if (route === 'network') {
    return;
  }
  if (route === 'document') {
    event.respondWith(documentResponse(event.request));
  } else {
    event.respondWith(cachedResponse(event, route));
  }
});
