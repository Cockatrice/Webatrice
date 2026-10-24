import {
  GAME_LINK_REGEX,
  containsGameLink,
  findLiveGameServer,
  isSameGameServer,
  makeGameJoinLink,
  needsDesktopPort,
  parseGameJoinLink,
} from './gameLink';

describe('makeGameJoinLink', () => {
  it('builds desktop\'s cockatrice://joingame link', () => {
    expect(makeGameJoinLink({ hostname: 'example.com', port: '4748', roomId: 1, gameId: 42, description: '' }))
      .toBe('cockatrice://joingame?hostname=example.com&port=4748&roomid=1&gameid=42');
  });

  it('percent-encodes the description so it survives chat as one word', () => {
    const link = makeGameJoinLink({ hostname: 'h', port: '1', roomId: 2, gameId: 3, description: 'Bo3 & "fun" 100%' });
    expect(link).toBe('cockatrice://joingame?hostname=h&port=1&roomid=2&gameid=3&game=Bo3%20%26%20%22fun%22%20100%25');
    expect(link).not.toMatch(/\s/);
  });
});

describe('parseGameJoinLink', () => {
  it('round-trips a built link', () => {
    const link = { hostname: 'Example.com', port: '4747', roomId: 7, gameId: 99, description: 'Modern, no proxies' };
    expect(parseGameJoinLink(makeGameJoinLink(link))).toEqual({ ok: true, link });
  });

  it('accepts links without a description (older desktop clients)', () => {
    expect(parseGameJoinLink('cockatrice://joingame?hostname=h&port=4747&roomid=1&gameid=5')).toEqual({
      ok: true,
      link: { hostname: 'h', port: '4747', roomId: 1, gameId: 5, description: '' },
    });
  });

  it('is case-insensitive on scheme and host, and keeps "+" literal as QUrl does', () => {
    const parsed = parseGameJoinLink('COCKATRICE://JoinGame?hostname=h&port=1&roomid=1&gameid=1&game=a+b');
    expect(parsed).toEqual({ ok: true, link: expect.objectContaining({ description: 'a+b' }) });
  });

  it.each([
    ['cockatrice://joingame?port=1&roomid=1&gameid=1', 'hostname'],
    ['cockatrice://joingame?hostname=h&roomid=1&gameid=1', 'port'],
    ['cockatrice://joingame?hostname=h&port=99999&roomid=1&gameid=1', 'port'],
    ['cockatrice://joingame?hostname=h&port=1&roomid=x&gameid=1', 'roomId'],
    ['cockatrice://joingame?hostname=h&port=1&roomid=2147483648&gameid=1', 'roomId'],
    ['cockatrice://joingame?hostname=h&port=1&roomid=-2147483649&gameid=1', 'roomId'],
    ['cockatrice://joingame?hostname=h&port=1&roomid=1', 'gameId'],
    ['cockatrice://joingame?hostname=h&port=1&roomid=1&gameid=4294967296', 'gameId'],
  ])('reports the first invalid field of %s', (url, error) => {
    expect(parseGameJoinLink(url)).toEqual({ ok: false, error });
  });
});

describe('live game server identity', () => {
  const hosts = [
    { host: 'live.example:5748/server-b', port: '5748', desktopPort: '8888' },
    { host: 'live.example:5748/server-a', port: '5748', desktopPort: '4747' },
  ];

  it('uses the desktop port only from the known host for the exact live endpoint', () => {
    expect(findLiveGameServer('wss://live.example:5748/server-a', hosts)).toEqual({
      hostname: 'live.example',
      port: '5748',
      desktopPort: '4747',
    });
    expect(findLiveGameServer('wss://live.example:5748/other-path', hosts)).toEqual({
      hostname: 'live.example',
      port: '5748',
      desktopPort: undefined,
    });
  });

  it('matches an incoming link by hostname and configured desktop port', () => {
    const live = findLiveGameServer('wss://live.example:5748/server-a', hosts)!;
    expect(isSameGameServer({ hostname: 'LIVE.EXAMPLE', port: '4747' }, live)).toBe(true);
    expect(isSameGameServer({ hostname: 'live.example', port: '5748' }, live)).toBe(false);
    expect(isSameGameServer({ hostname: 'live.example', port: '8888' }, live)).toBe(false);
  });

  it('fails closed when the live endpoint has no known desktop port', () => {
    const live = findLiveGameServer('wss://unknown.example:5748/server-a', hosts)!;
    expect(isSameGameServer({ hostname: 'unknown.example', port: '5748' }, live)).toBe(false);
  });

  it.each([undefined, '0', '65536', 'abc'])('rejects invalid desktop port %s', (desktopPort) => {
    const live = findLiveGameServer('wss://live.example:5748/server-a', [
      { host: 'live.example:5748/server-a', port: '5748', desktopPort },
    ]);
    expect(live?.desktopPort).toBeUndefined();
    expect(isSameGameServer({ hostname: 'live.example', port: '4747' }, live)).toBe(false);
  });

  it('asks for a desktop port only for a link to the live host when none is saved', () => {
    const unmapped = { hostname: 'live.example', port: '5748' };
    expect(needsDesktopPort({ hostname: 'LIVE.example' }, unmapped)).toBe(true);
    expect(needsDesktopPort({ hostname: 'other.example' }, unmapped)).toBe(false);
    expect(needsDesktopPort({ hostname: 'live.example' }, { ...unmapped, desktopPort: '4747' })).toBe(false);
    expect(needsDesktopPort({ hostname: 'live.example' }, null)).toBe(false);
  });
});

describe('GAME_LINK_REGEX / containsGameLink', () => {
  const link = 'cockatrice://joingame?hostname=h&port=1&roomid=1&gameid=1';

  it('splits a chat line around each link', () => {
    expect(`Join my game (#1): ${link} now`.split(GAME_LINK_REGEX)).toEqual(['Join my game (#1): ', link, ' now']);
  });

  it('ignores other cockatrice:// actions and look-alike hosts', () => {
    expect(containsGameLink('cockatrice://opendeck?share=x')).toBe(false);
    expect(containsGameLink('cockatrice://joingamefoo?x')).toBe(false);
    expect(containsGameLink(`see ${link}`)).toBe(true);
  });
});
