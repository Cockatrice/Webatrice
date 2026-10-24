import { lazyRoutes, prefetchRoutes } from './lazyRoutes';

it('prefetches every registered lazy route once and absorbs background failures', async () => {
  const loaders = Object.values(lazyRoutes).map(route => vi.spyOn(route, 'preload').mockResolvedValue({ default: () => null }));
  loaders[0].mockRejectedValue(new Error('offline'));
  prefetchRoutes();
  await Promise.resolve();
  prefetchRoutes();
  for (const load of loaders) {
    expect(load).toHaveBeenCalledTimes(1);
  }
});
