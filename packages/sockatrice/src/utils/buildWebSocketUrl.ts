// See .github/instructions/sockatrice-transport.instructions.md#websocket-url-construction.
export function buildWebSocketUrl(
  protocol: 'ws' | 'wss',
  host: string,
  port: string | number,
): string {
  if (host.includes('/')) {
    return `${protocol}://${host}`;
  }
  return `${protocol}://${host}:${port}`;
}
