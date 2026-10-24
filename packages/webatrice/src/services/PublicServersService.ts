import { z } from 'zod';

export const PUBLIC_SERVERS_URL = 'https://cockatrice.github.io/public-servers.json';

const FETCH_TIMEOUT_MS = 10_000;
const CACHE_KEY = 'webatrice.publicServers';

export interface PublicServer {
  name: string;
  host: string;
  port?: string;
  websocketPort?: string;
  site?: string;
  location?: string;
  isInactive: boolean;
}

export interface PublicServerList {
  servers: PublicServer[];
  stale: boolean;
}

const portSchema = z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).transform(String);

const entrySchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: portSchema.optional(),
  websocketPort: portSchema.optional(),
  site: z.string().optional(),
  location: z.string().optional(),
  isInactive: z.boolean().optional().default(false),
});

const documentSchema = z.object({ servers: z.array(z.unknown()) });

export function parsePublicServers(json: unknown): PublicServer[] {
  const { servers } = documentSchema.parse(json);
  return servers.flatMap((entry) => {
    const parsed = entrySchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export const SECURE_WEBSOCKET_PORT = '443';

export const isWebSocketReachable = (server: PublicServer): boolean =>
  !server.isInactive && server.websocketPort === SECURE_WEBSOCKET_PORT;

function readCache(): PublicServer[] | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? parsePublicServers(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(servers: PublicServer[]): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ servers }));
  } catch {
    // Storage full or blocked: the cache is a convenience, not a requirement.
  }
}

export async function fetchPublicServers(timeoutMs = FETCH_TIMEOUT_MS): Promise<PublicServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(PUBLIC_SERVERS_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Public server list request failed: ${response.status}`);
    }
    return parsePublicServers(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function loadPublicServers(): Promise<PublicServerList> {
  try {
    const servers = await fetchPublicServers();
    writeCache(servers);
    return { servers, stale: false };
  } catch (error) {
    const cached = readCache();
    if (cached) {
      return { servers: cached, stale: true };
    }
    throw error;
  }
}
