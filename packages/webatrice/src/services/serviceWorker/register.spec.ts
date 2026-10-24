import { configureServiceWorker, isDisabled, registerAfterPaint } from './register';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function setup() {
  const scope = new URL('/Webatrice/', location.href).href;
  const active = { postMessage: vi.fn() };
  const waiting = { postMessage: vi.fn() };
  const registration = { scope, active, waiting, installing: null, unregister: vi.fn().mockResolvedValue(true) };
  const unrelated = { scope: new URL('/other/', location.href).href, unregister: vi.fn() };
  const serviceWorker = {
    register: vi.fn().mockResolvedValue(registration),
    getRegistration: vi.fn().mockResolvedValue(registration),
    getRegistrations: vi.fn().mockResolvedValue([registration, unrelated]),
  };
  vi.stubGlobal('navigator', { serviceWorker });
  return { serviceWorker, registration, unrelated, active, waiting };
}

it('activates an already waiting update on this load and registers with the deployment scope', async () => {
  const { serviceWorker, waiting } = setup();
  await configureServiceWorker('/Webatrice/', false);
  expect(waiting.postMessage).toHaveBeenCalledExactlyOnceWith('ACTIVATE_ON_LOAD');
  expect(serviceWorker.register).toHaveBeenCalledExactlyOnceWith('/Webatrice/sw.js', {
    scope: '/Webatrice/', updateViaCache: 'none',
  });
});

it('unregisters and clears only this deployment, telling active workers to bypass caching', async () => {
  const { serviceWorker, registration, unrelated, active, waiting } = setup();
  const cacheStorage = {
    keys: vi.fn().mockResolvedValue(['webatrice:/Webatrice/:old', 'webatrice:/Webatrice/:images', 'unrelated']),
    delete: vi.fn().mockResolvedValue(true),
  };
  vi.stubGlobal('caches', cacheStorage);
  await configureServiceWorker('/Webatrice/', true);
  expect(active.postMessage).toHaveBeenCalledWith('DISABLE');
  expect(waiting.postMessage).toHaveBeenCalledWith('DISABLE');
  expect(registration.unregister).toHaveBeenCalledOnce();
  expect(unrelated.unregister).not.toHaveBeenCalled();
  expect(cacheStorage.delete.mock.calls).toEqual([
    ['webatrice:/Webatrice/:old'], ['webatrice:/Webatrice/:images'],
  ]);
  expect(serviceWorker.register).not.toHaveBeenCalled();
});

it('accepts a query parameter or any present localStorage flag, including when storage is denied', () => {
  expect(isDisabled('?sw-disable', { getItem: () => null })).toBe(true);
  expect(isDisabled('', { getItem: () => '1' })).toBe(true);
  expect(isDisabled('', { getItem: () => '' })).toBe(true);
  expect(isDisabled('', { getItem: () => null })).toBe(false);
  expect(isDisabled('', { getItem: () => {
    throw new Error('denied');
  } })).toBe(false);
});

it.each([[false, 'development'], [true, 'test']])('never registers for PROD=%s MODE=%s', (prod, mode) => {
  setup();
  vi.stubEnv('PROD', prod);
  vi.stubEnv('MODE', mode);
  const frame = vi.fn();
  vi.stubGlobal('requestAnimationFrame', frame);
  registerAfterPaint();
  expect(frame).not.toHaveBeenCalled();
});

it('waits until after a paint opportunity before registering production builds', async () => {
  const { serviceWorker } = setup();
  vi.stubEnv('PROD', true);
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('BASE_URL', '/Webatrice/');
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
  registerAfterPaint();
  expect(serviceWorker.getRegistration).not.toHaveBeenCalled();
  callbacks.shift()!(0);
  expect(serviceWorker.getRegistration).not.toHaveBeenCalled();
  callbacks.shift()!(16);
  await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalledOnce());
});
