export interface WorkerManifest {
  base: string;
  hash: string;
  precache: string[];
  publicFiles: string[];
  bytes: number;
}

export function cachePrefix(base: string): string {
  return `webatrice:${base}:`;
}

export function routeRequest(
  request: Pick<Request, 'url' | 'method' | 'mode' | 'destination'>,
  origin: string,
  manifest: Pick<WorkerManifest, 'base' | 'publicFiles'>,
): 'network' | 'document' | 'asset' | 'public' | 'image' {
  const url = new URL(request.url);
  if (request.method !== 'GET' || !['http:', 'https:'].includes(url.protocol)
    || url.searchParams.has('sw-disable')) {
    return 'network';
  }
  if (url.origin !== origin) {
    return url.origin === 'https://cards.scryfall.io' && request.destination === 'image'
      ? 'image' : 'network';
  }
  if (!url.pathname.startsWith(manifest.base)) {
    return 'network';
  }
  const file = url.pathname.slice(manifest.base.length);
  if (request.mode === 'navigate' || file === 'index.html' || file === '') {
    return 'document';
  }
  if (/^assets\/.+-[\w-]{8,}\.[\w.]+$/.test(file)) {
    return 'asset';
  }
  return manifest.publicFiles.includes(url.pathname) ? 'public' : 'network';
}

export function oldestEntries<T>(entries: readonly T[], cap: number): T[] {
  return entries.slice(0, Math.max(0, entries.length - Math.max(0, cap)));
}
