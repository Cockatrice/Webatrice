// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { create, setExtension, toBinary } from '@bufbuild/protobuf';
import { Event_ServerIdentification_ext, Event_ServerIdentificationSchema, ServerMessageSchema,
  ServerMessage_MessageType, SessionEventSchema } from '@cockatrice/sockatrice/generated';
import globalSetup from './global-setup';

const frame = vi.hoisted(() => ({ bytes: new Uint8Array() }));
vi.mock('ws', () => ({ default: class {
  close() {}
  on(event: string, callback: (data: Uint8Array) => void) {
    if (event === 'message') {
      queueMicrotask(() => callback(frame.bytes));
    }
    return this;
  }
} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it.each([
  ['3.1.0 ()', 'custom/servatrice:stable'],
  ['3.0.0 ()', 'custom/servatrice:master'],
  ['Development-3.1.0-beta.7', 'custom/servatrice:3.1'],
])('records advertised version %s independently of image %s', async (version, image) => {
  vi.stubEnv('SERVATRICE_IMAGE', image);
  vi.stubEnv('SERVATRICE_ADVERTISED_VERSION', undefined);
  const sessionEvent = create(SessionEventSchema);
  setExtension(sessionEvent, Event_ServerIdentification_ext, create(Event_ServerIdentificationSchema, { serverVersion: version }));
  const message = create(ServerMessageSchema, { messageType: ServerMessage_MessageType.SESSION_EVENT, sessionEvent });
  frame.bytes = toBinary(ServerMessageSchema, message);
  await globalSetup();
  expect(process.env.SERVATRICE_ADVERTISED_VERSION).toBe(version);
});
