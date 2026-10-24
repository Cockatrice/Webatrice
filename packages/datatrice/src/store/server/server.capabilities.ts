export const ServerCapability = {
  REPORTS: 'reports',
  MODERATION_TOOLS: 'moderationTools',
  CARD_ART: 'cardArt',
  PLAYMATS: 'playmats',
  DECK_SHARING: 'deckSharing',
  DEVELOPER_ROLE: 'developerRole',
} as const;

export type ServerCapability = typeof ServerCapability[keyof typeof ServerCapability];

export interface ServerVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly (string | number)[];
}

const version = (major: number, minor: number, patch: number, ...prerelease: (string | number)[]): ServerVersion =>
  ({ major, minor, patch, prerelease });

const MIN_SERVER_VERSION: Record<ServerCapability, ServerVersion> = {
  [ServerCapability.CARD_ART]: version(3, 1, 0, 'beta', 2),
  [ServerCapability.REPORTS]: version(3, 1, 0, 'beta', 8),
  [ServerCapability.MODERATION_TOOLS]: version(3, 1, 0, 'beta', 8),
  [ServerCapability.PLAYMATS]: version(3, 1, 0, 'beta', 8),
  [ServerCapability.DEVELOPER_ROLE]: version(3, 1, 0, 'beta', 12),
  [ServerCapability.DECK_SHARING]: version(3, 1, 0, 'beta', 13),
};

export function parseServerVersion(raw: string | null | undefined): ServerVersion | null {
  const match = /^\s*(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(raw ?? '');
  if (!match) {
    return null;
  }
  const prerelease = match[4]
    ? match[4].split('.').map((part) => (/^\d+$/.test(part) ? Number(part) : part))
    : [];
  return version(Number(match[1]), Number(match[2]), Number(match[3]), ...prerelease);
}

function comparePrerelease(a: ServerVersion['prerelease'], b: ServerVersion['prerelease']): number {
  if (a.length === 0 || b.length === 0) {
    return b.length - a.length;
  }
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) {
      continue;
    }
    if (typeof x === 'number' && typeof y === 'number') {
      return x - y;
    }
    if (typeof x === 'number') {
      return -1;
    }
    if (typeof y === 'number') {
      return 1;
    }
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

function atLeast(actual: ServerVersion, min: ServerVersion): boolean {
  const core = (actual.major - min.major) || (actual.minor - min.minor) || (actual.patch - min.patch);
  return core !== 0 ? core > 0 : comparePrerelease(actual.prerelease, min.prerelease) >= 0;
}

export function serverSupports(raw: string | null | undefined, capability: ServerCapability): boolean {
  const parsed = parseServerVersion(raw);
  return parsed !== null && atLeast(parsed, MIN_SERVER_VERSION[capability]);
}
