import type { PublicServer } from '@app/services';

import { publicServerOptions, toSavedHost } from './usePublicServers';

const server = (overrides: Partial<PublicServer>): PublicServer => ({
  name: 'Server',
  host: 'server.example',
  port: '4747',
  websocketPort: '4748',
  isInactive: false,
  ...overrides,
});

describe('publicServerOptions', () => {
  it('leaves out servers the user already saved, matching by address even when the saved host has a path', () => {
    const options = publicServerOptions(
      [server({ name: 'Rooster', host: 'server.cockatrice.us' }), server({ name: 'New', host: 'new.example' })],
      [{ host: 'Server.Cockatrice.us/servatrice' }],
    );
    expect(options.map((o) => o.server.name)).toEqual(['New']);
  });

  it('drops inactive servers as desktop does', () => {
    expect(publicServerOptions([server({ isInactive: true })], [])).toEqual([]);
  });

  it('marks servers without a WebSocket port as unavailable to the browser', () => {
    const [option] = publicServerOptions([server({ websocketPort: undefined })], []);
    expect(option.unavailableReason).toBe('noWebSocket');
  });

  it('marks servers whose WebSocket port is not 443 as unavailable, since desktop dials them over plain ws', () => {
    const [option] = publicServerOptions([server({ websocketPort: '4748' })], []);
    expect(option.unavailableReason).toBe('noSecureWebSocket');
  });

  it('offers servers with a secure WebSocket port', () => {
    const [option] = publicServerOptions([server({ websocketPort: '443' })], []);
    expect(option.unavailableReason).toBeNull();
  });
});

describe('toSavedHost', () => {
  it('saves the server with desktop\'s /servatrice path on its WebSocket port as a user-editable host', () => {
    expect(toSavedHost(server({ name: 'New', host: 'new.example', websocketPort: '443' }))).toEqual({
      name: 'New',
      host: 'new.example/servatrice',
      port: '443',
      editable: true,
    });
  });
});
