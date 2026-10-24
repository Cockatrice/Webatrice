import { fetchCollection, fetchNamedCard } from './client';

let epoch = 0;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(epoch += 1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shares normalized names and cancels only the abandoned subscriber', async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
    finish = resolve;
  }));
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  const abandoned = fetchNamedCard('Opt', controller.signal).catch((error: unknown) => error);
  const surviving = fetchNamedCard('OPT');
  await vi.advanceTimersByTimeAsync(120);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  controller.abort();
  expect(await abandoned).toMatchObject({ name: 'AbortError' });
  expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].signal?.aborted).toBe(false);
  finish(new Response(JSON.stringify({ id: 'opt', name: 'Opt' })));
  expect(await surviving).toMatchObject({ id: 'opt' });
});

it('shares overlapping batch names and distinguishes printing hints', async () => {
  const bodies: unknown[] = [];
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    if (bodies.length === 1) {
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'xln', name: 'Opt', set: 'xln', collector_number: '65' }] })));
  }));
  const first = fetchCollection([{ name: 'Opt' }, { name: 'Island' }]);
  const second = fetchCollection([{ name: 'OPT' }]);
  const hinted = fetchCollection([{ name: 'Opt', set: 'XLN', collectorNumber: '65' }]);
  await vi.advanceTimersByTimeAsync(350);
  expect(bodies).toEqual([
    { identifiers: [{ name: 'Opt' }, { name: 'Island' }] },
    { identifiers: [{ set: 'xln', collector_number: '65' }] },
  ]);
  finish(new Response(JSON.stringify({ data: [{ id: 'default', name: 'Opt' }] })));
  expect((await first).get('Opt')?.id).toBe('default');
  expect((await second).get('OPT')?.id).toBe('default');
  expect((await hinted).get('Opt')?.id).toBe('xln');
});

it('aborts the underlying request when its last subscriber leaves', async () => {
  let requestSignal: AbortSignal | undefined;
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
    requestSignal = init.signal!;
    return new Promise<Response>((_resolve, reject) => {
      requestSignal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  }));
  const controller = new AbortController();
  const result = fetchNamedCard('Island', controller.signal).catch((error: unknown) => error);
  await vi.advanceTimersByTimeAsync(120);
  controller.abort();
  expect(await result).toMatchObject({ name: 'AbortError' });
  expect(requestSignal?.aborted).toBe(true);
});

it('removes a shared request from the queue when its final subscriber cancels', async () => {
  const starts: Array<[string, number]> = [];
  const start = Date.now();
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    starts.push([url.split('exact=')[1], Date.now() - start]);
    return Promise.resolve(new Response(JSON.stringify({ id: 'card', name: 'Card' })));
  }));
  await fetchNamedCard('First');
  const first = new AbortController();
  const second = new AbortController();
  const a = fetchNamedCard('Queued', first.signal).catch((error: unknown) => error);
  const b = fetchNamedCard('Queued', second.signal).catch((error: unknown) => error);
  first.abort();
  second.abort();
  const next = fetchNamedCard('Next');
  await vi.advanceTimersByTimeAsync(100);
  expect(starts).toEqual([['First', 0], ['Next', 100]]);
  expect(await a).toMatchObject({ name: 'AbortError' });
  expect(await b).toMatchObject({ name: 'AbortError' });
  await next;
});

it('keeps a shared batch alive for remaining callers and permits a fresh lookup after cancellation', async () => {
  let finish!: (response: Response) => void;
  let sharedSignal: AbortSignal | null | undefined;
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    sharedSignal = init.signal;
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  const controller = new AbortController();
  const abandoned = fetchCollection([{ name: 'Forest' }, { name: 'Mountain' }], controller.signal).catch((error: unknown) => error);
  const retained = fetchCollection([{ name: 'Forest' }]);
  controller.abort();
  expect(await abandoned).toMatchObject({ name: 'AbortError' });
  expect(sharedSignal?.aborted).toBe(false);
  finish(new Response(JSON.stringify({ data: [{ id: 'forest', name: 'Forest' }] })));
  expect((await retained).get('Forest')?.id).toBe('forest');
  fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ id: 'mountain', name: 'Mountain' }))));
  const fresh = fetchNamedCard('Mountain');
  await vi.advanceTimersByTimeAsync(100);
  expect(await fresh).toMatchObject({ id: 'mountain' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
