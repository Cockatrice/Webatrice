import { describe, it, expect } from 'vitest';

import { installMockWebSocketHarness, makeMockWebSocketInstance } from '../testing/mock-websocket';
import { terminateSocket } from './terminateSocket';

describe('terminateSocket', () => {
  it('closes immediately when the socket is OPEN', () => {
    const { restore } = installMockWebSocketHarness();
    const socket = makeMockWebSocketInstance();
    socket.readyState = WebSocket.OPEN;

    terminateSocket(socket as unknown as WebSocket);

    expect(socket.close).toHaveBeenCalledTimes(1);
    restore();
  });

  it('defers a clean close to onopen when the socket is still CONNECTING', () => {
    const { restore } = installMockWebSocketHarness();
    const socket = makeMockWebSocketInstance();
    socket.readyState = WebSocket.CONNECTING;

    terminateSocket(socket as unknown as WebSocket);

    // Not aborted synchronously (that would fail the connection abnormally).
    expect(socket.close).not.toHaveBeenCalled();
    expect(typeof socket.onopen).toBe('function');

    // Once the handshake completes, it closes cleanly.
    socket.onopen?.();
    expect(socket.close).toHaveBeenCalledTimes(1);
    restore();
  });

  it('does nothing when the socket is already CLOSING/CLOSED', () => {
    const { restore } = installMockWebSocketHarness();
    const socket = makeMockWebSocketInstance();
    socket.readyState = WebSocket.CLOSED;

    terminateSocket(socket as unknown as WebSocket);

    expect(socket.close).not.toHaveBeenCalled();
    restore();
  });
});
