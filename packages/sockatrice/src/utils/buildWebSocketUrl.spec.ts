import { describe, it, expect } from 'vitest';

import { buildWebSocketUrl } from './buildWebSocketUrl';

describe('buildWebSocketUrl', () => {
  it('uses wss:// and includes the port for direct (pathless) remote endpoints', () => {
    expect(buildWebSocketUrl('mtg.chickatrice.net', '443')).toBe(
      'wss://mtg.chickatrice.net:443',
    );
  });

  it('uses wss:// and drops the port for nginx-proxied hosts that bake a path into the host string', () => {
    expect(buildWebSocketUrl('server.cockatrice.us/servatrice', '4748')).toBe(
      'wss://server.cockatrice.us/servatrice',
    );
  });

  it('preserves multi-segment proxy paths', () => {
    expect(buildWebSocketUrl('example.com/foo/bar', '443')).toBe(
      'wss://example.com/foo/bar',
    );
  });

  it('uses ws:// for a local target host', () => {
    expect(buildWebSocketUrl('localhost', 4748)).toBe('ws://localhost:4748');
  });

  it('uses ws:// for the loopback IP', () => {
    expect(buildWebSocketUrl('127.0.0.1', '4748')).toBe('ws://127.0.0.1:4748');
  });

  it('treats the local-host check case-insensitively', () => {
    expect(buildWebSocketUrl('LOCALHOST', '4748')).toBe('ws://LOCALHOST:4748');
  });

  it('treats *.localhost names as local', () => {
    expect(buildWebSocketUrl('foo.localhost', '4748')).toBe('ws://foo.localhost:4748');
  });

  it('uses ws:// for a proxied local target and drops the port', () => {
    expect(buildWebSocketUrl('localhost/servatrice', 4748)).toBe(
      'ws://localhost/servatrice',
    );
  });
});
