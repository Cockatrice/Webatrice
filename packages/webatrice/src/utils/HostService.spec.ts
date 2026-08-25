import { Host } from '@app/types';

import { getHostPort } from './HostService';

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
    // Older seeds persisted localHost/localPort; those fields are gone from the
    // type but may still exist as inert properties on a user's stored records.
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
