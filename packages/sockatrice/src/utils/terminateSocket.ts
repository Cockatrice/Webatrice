export function terminateSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.onopen = () => socket.close();
    return;
  }
  if (socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
}
