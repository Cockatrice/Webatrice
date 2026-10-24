import { detectDesktopOs } from './desktopPaths';

it.each([
  ['Windows', '', 'windows'],
  ['Win32', '', 'windows'],
  ['macOS', '', 'macos'],
  ['MacIntel', '', 'macos'],
  ['Linux x86_64', '', 'linux'],
  ['', 'Mozilla/5.0 (X11; Linux x86_64)', 'linux'],
])('detects platform "%s" with agent "%s" as %s', (platform, userAgent, os) => {
  expect(detectDesktopOs(platform, userAgent)).toBe(os);
});
