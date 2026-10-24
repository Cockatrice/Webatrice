import {
  fetchPublicServers,
  isWebSocketReachable,
  loadPublicServers,
  parsePublicServers,
  PUBLIC_SERVERS_URL,
} from './PublicServersService';

const DOCUMENT = {
  servers: [
    {
      id: 0, name: 'Chickatrice', site: 'https://www.chickatrice.net/', location: 'Australia',
      host: 'mtg.chickatrice.net', port: 4747, websocketPort: 4748, authRequired: true, regRequired: false,
    },
    { id: 1, name: 'Dr4ft Cockatrice', site: 'http://www.dr4ft.com/', host: 'cockatrice.dr4ft.com', isInactive: true },
    { id: 5, name: 'Desktop Only', host: 'tcp.example.org', port: 4747 },
  ],
};

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('parsePublicServers', () => {
  it('reads the published document, normalising ports to strings', () => {
    expect(parsePublicServers(DOCUMENT)).toEqual([
      {
        name: 'Chickatrice', host: 'mtg.chickatrice.net', port: '4747', websocketPort: '4748',
        site: 'https://www.chickatrice.net/', location: 'Australia', isInactive: false,
      },
      { name: 'Dr4ft Cockatrice', host: 'cockatrice.dr4ft.com', site: 'http://www.dr4ft.com/', isInactive: true },
      { name: 'Desktop Only', host: 'tcp.example.org', port: '4747', isInactive: false },
    ]);
  });

  it('skips malformed entries instead of discarding the whole list', () => {
    const servers = parsePublicServers({ servers: [{ host: 'no-name.example' }, 'junk', DOCUMENT.servers[0]] });
    expect(servers.map((s) => s.name)).toEqual(['Chickatrice']);
  });

  it('rejects a document without a server list', () => {
    expect(() => parsePublicServers({ hosts: [] })).toThrow();
    expect(() => parsePublicServers(null)).toThrow();
  });
});

describe('isWebSocketReachable', () => {
  it('requires an active server with a WebSocket port on 443, the only port desktop dials over wss', () => {
    const [chickatrice, inactive, desktopOnly] = parsePublicServers(DOCUMENT);
    expect(isWebSocketReachable(chickatrice)).toBe(false);
    expect(isWebSocketReachable({ ...chickatrice, websocketPort: '443' })).toBe(true);
    expect(isWebSocketReachable({ ...inactive, websocketPort: '443' })).toBe(false);
    expect(isWebSocketReachable(desktopOnly)).toBe(false);
  });
});

describe('fetching', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('downloads the desktop list URL', async () => {
    fetchMock.mockResolvedValue(okResponse(DOCUMENT));
    await expect(fetchPublicServers()).resolves.toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledWith(PUBLIC_SERVERS_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('aborts a download that outlives the timeout', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    const pending = fetchPublicServers(1000);
    vi.advanceTimersByTime(1000);
    await expect(pending).rejects.toThrow('aborted');
  });

  it('rejects an HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchPublicServers()).rejects.toThrow('503');
  });

  it('caches a successful download and falls back to it when offline', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(DOCUMENT));
    await expect(loadPublicServers()).resolves.toMatchObject({ stale: false });

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const fallback = await loadPublicServers();
    expect(fallback.stale).toBe(true);
    expect(fallback.servers.map((s) => s.name)).toEqual(['Chickatrice', 'Dr4ft Cockatrice', 'Desktop Only']);
  });

  it('falls back to the cache when the download is malformed', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(DOCUMENT));
    await loadPublicServers();

    fetchMock.mockResolvedValueOnce(okResponse({ unexpected: true }));
    await expect(loadPublicServers()).resolves.toMatchObject({ stale: true });
  });

  it('rejects when offline with nothing cached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(loadPublicServers()).rejects.toThrow('Failed to fetch');
  });
});
