const COMMIT_SHA = /^[0-9a-f]{12,40}$/i;

export function shortVersion(version: string): string {
  return COMMIT_SHA.test(version) ? version.slice(0, 7) : version;
}
