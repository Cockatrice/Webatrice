// See .github/instructions/sockatrice-transport.instructions.md#websocket-url-construction.

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// ws:// only when the TARGET is a local cert-less servatrice. The page origin
// is irrelevant: an http://localhost page may open wss:// (mixed-content rules
// only block insecure-from-secure, not the reverse).
function isLocalTargetHost(host: string): boolean {
  const hostname = host.split('/')[0].toLowerCase();
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost');
}

export function buildWebSocketUrl(host: string, port: string | number): string {
  const protocol = isLocalTargetHost(host) ? 'ws' : 'wss';
  if (host.includes('/')) {
    return `${protocol}://${host}`;
  }
  return `${protocol}://${host}:${port}`;
}
