export type DesktopOs = 'windows' | 'macos' | 'linux';

export const DESKTOP_DATA_FOLDERS: Record<DesktopOs, string> = {
  windows: '%LOCALAPPDATA%\\Cockatrice\\Cockatrice',
  macos: '~/Library/Application Support/Cockatrice/Cockatrice',
  linux: '~/.local/share/Cockatrice/Cockatrice',
};

export function detectDesktopOs(platform: string, userAgent = ''): DesktopOs {
  const text = `${platform} ${userAgent}`.toLowerCase();
  if (text.includes('win')) {
    return 'windows';
  }
  if (text.includes('mac') || text.includes('darwin')) {
    return 'macos';
  }
  return 'linux';
}

export function currentDesktopOs(): DesktopOs {
  const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { userAgentData?: { platform?: string } };
  return detectDesktopOs(nav?.userAgentData?.platform ?? nav?.platform ?? '', nav?.userAgent ?? '');
}
