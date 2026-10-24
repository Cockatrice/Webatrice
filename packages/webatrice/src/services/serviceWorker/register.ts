import { cachePrefix } from './policy';

export function isDisabled(search: string, storage: Pick<Storage, 'getItem'>): boolean {
  if (new URLSearchParams(search).has('sw-disable')) {
    return true;
  }
  try {
    return storage.getItem('sw-disable') !== null;
  } catch {
    return false;
  }
}

export async function configureServiceWorker(base: string, disable: boolean) {
  const scope = new URL(base, location.href).href;
  if (disable) {
    const registrations = (await navigator.serviceWorker.getRegistrations())
      .filter((registration) => registration.scope === scope);
    for (const registration of registrations) {
      for (const target of [registration.active, registration.waiting, registration.installing]) {
        target?.postMessage('DISABLE');
      }
      await registration.unregister();
    }
    if ('caches' in globalThis) {
      await Promise.all((await caches.keys()).filter((name) => name.startsWith(cachePrefix(base)))
        .map((name) => caches.delete(name)));
    }
    return;
  }
  const existing = await navigator.serviceWorker.getRegistration(scope);
  if (existing?.scope === scope) {
    existing.waiting?.postMessage('ACTIVATE_ON_LOAD');
  }
  await navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' });
}

export function registerAfterPaint() {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'test' || !('serviceWorker' in navigator)) {
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => {
    let disable = new URLSearchParams(location.search).has('sw-disable');
    try {
      disable = isDisabled(location.search, localStorage);
    } catch {
      // Some browser privacy settings deny access to localStorage itself.
    }
    void configureServiceWorker(import.meta.env.BASE_URL, disable).catch(() => undefined);
  }));
}
