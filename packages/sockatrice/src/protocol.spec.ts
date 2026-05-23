// Negotiation suite. Sockatrice's responsibility at the protocol layer is to
// (a) advertise a stable PROTOCOL_VERSION + SOCKATRICE_FEATURES set, and
// (b) interpret the server's ServerIdentification handshake. The other side
// of the wire (request facade, identity, client policy decisions) lives in
// the app per [[project_sockatrice-app-boundary]].
//
// These tests cover the protocol constants, the wire format of
// Event_ServerIdentification, and the feature-bit decoding path used by
// `WebClient.testConnect`. They run in the unit suite — no real
// WebSocket, no Servatrice — so they're a fast regression gate for
// "does the client still speak the same handshake the server expects".

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import {
  Event_ServerIdentification_ServerOptions,
  Event_ServerIdentificationSchema,
} from './generated';
import { PROTOCOL_VERSION, SOCKATRICE_FEATURES } from './protocol';
import { passwordSaltSupported } from './utils/passwordHasher';

describe('Protocol negotiation', () => {
  describe('PROTOCOL_VERSION constant', () => {
    it('matches the upstream Cockatrice C++ constant (14)', () => {
      expect(PROTOCOL_VERSION).toBe(14);
    });

    it('is a positive integer (sanity)', () => {
      expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
      expect(PROTOCOL_VERSION).toBeGreaterThan(0);
    });
  });

  describe('SOCKATRICE_FEATURES constant', () => {
    const expected = [
      'client_id',
      'client_ver',
      'feature_set',
      'room_chat_history',
      'client_warnings',
      'forgot_password',
      'idle_client',
      'mod_log_lookup',
      'user_ban_history',
      'websocket',
    ];

    it('contains every protocol-layer feature flag the desktop client advertises', () => {
      expect([...SOCKATRICE_FEATURES]).toEqual(expected);
    });

    it('does not contain identity or policy flags (those belong to the app layer)', () => {
      // Reference: [[project_sockatrice-app-boundary]]. The app is responsible
      // for adding things like '2.7.0_min_version', '2.8.0_min_version', etc.
      expect(SOCKATRICE_FEATURES).not.toContain('2.7.0_min_version');
      expect(SOCKATRICE_FEATURES).not.toContain('2.8.0_min_version');
    });
  });

  describe('Event_ServerIdentification round-trip', () => {
    it('encodes and decodes all four fields without loss', () => {
      const msg = create(Event_ServerIdentificationSchema, {
        serverName: 'TestServer',
        serverVersion: '2.8.0',
        protocolVersion: PROTOCOL_VERSION,
        serverOptions: Event_ServerIdentification_ServerOptions.SupportsPasswordHash,
      });
      const bytes = toBinary(Event_ServerIdentificationSchema, msg);
      const parsed = fromBinary(Event_ServerIdentificationSchema, bytes);

      expect(parsed.serverName).toBe('TestServer');
      expect(parsed.serverVersion).toBe('2.8.0');
      expect(parsed.protocolVersion).toBe(PROTOCOL_VERSION);
      expect(parsed.serverOptions).toBe(Event_ServerIdentification_ServerOptions.SupportsPasswordHash);
    });

    it('defaults server_options to NoOptions when the server omits it', () => {
      const msg = create(Event_ServerIdentificationSchema, {
        serverName: 'LegacyServer',
        serverVersion: '2.6.0',
        protocolVersion: PROTOCOL_VERSION,
      });
      const bytes = toBinary(Event_ServerIdentificationSchema, msg);
      const parsed = fromBinary(Event_ServerIdentificationSchema, bytes);

      expect(parsed.serverOptions).toBe(Event_ServerIdentification_ServerOptions.NoOptions);
    });
  });

  describe('Feature-bit decoding', () => {
    it('passwordSaltSupported reports true when SupportsPasswordHash is set', () => {
      expect(passwordSaltSupported(Event_ServerIdentification_ServerOptions.SupportsPasswordHash)).toBe(true);
    });

    it('passwordSaltSupported reports false for NoOptions', () => {
      expect(passwordSaltSupported(Event_ServerIdentification_ServerOptions.NoOptions)).toBe(false);
    });

    it('passwordSaltSupported masks unknown future bits gracefully', () => {
      // A future server might advertise additional bits alongside
      // SupportsPasswordHash; the bitmask read must isolate the bit it cares
      // about and ignore the rest.
      const futureWithHash = Event_ServerIdentification_ServerOptions.SupportsPasswordHash | 0b1110;
      expect(passwordSaltSupported(futureWithHash)).toBe(true);

      const futureWithoutHash = 0b1110;
      expect(passwordSaltSupported(futureWithoutHash)).toBe(false);
    });
  });
});
