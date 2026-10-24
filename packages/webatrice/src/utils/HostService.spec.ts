import { Host } from '@app/types';

import { getHostKey, getHostPort } from './HostService';

describe('getHostPort', () => {
  it('returns the host and port verbatim', () => {
    const host = {
      name: 'Rooster',
      host: 'server.cockatrice.us/servatrice',
      port: '4748',
      editable: false,
    } as Host;
    expect(getHostPort(host)).toEqual({
      host: 'server.cockatrice.us/servatrice',
      port: '4748',
    });
  });

  it('ignores legacy localHost/localPort left on stale IndexedDB records', () => {
    const stale = {
      name: 'Rooster',
      host: 'server.cockatrice.us/servatrice',
      port: '4748',
      localHost: 'server.cockatrice.us',
      localPort: '4748',
      editable: false,
    } as unknown as Host;
    expect(getHostPort(stale)).toEqual({
      host: 'server.cockatrice.us/servatrice',
      port: '4748',
    });
  });

  it('returns empty strings when no host is provided', () => {
    expect(getHostPort(undefined as unknown as Host)).toEqual({ host: '', port: '' });
  });
});

describe('getHostKey', () => {
  it('joins the address and port', () => {
    const host = { name: 'Rooster', host: 'server.cockatrice.us/servatrice', port: '4748', editable: false } as Host;
    expect(getHostKey(host)).toBe('server.cockatrice.us/servatrice:4748');
  });
});
