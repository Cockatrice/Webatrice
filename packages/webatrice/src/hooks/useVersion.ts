import { useEffect, useState } from 'react';

// Build-time commit SHA written by prebuild.js into public/version.txt and
// served at /version.txt. Returns null until the fetch resolves; consumers
// render conditionally.
export function useVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/version.txt')
      .then(r => (r.ok ? r.text() : null))
      .then(t => setVersion(t?.trim() ?? null))
      .catch(() => setVersion(null));
  }, []);

  return version;
}
