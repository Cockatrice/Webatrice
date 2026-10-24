import { execFileSync } from 'node:child_process';
import { posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findPathCaseClashes(paths) {
  const entries = new Map();
  const stems = new Map();
  const clashes = new Set();

  for (const path of paths) {
    const parts = path.split('/');
    for (let depth = 1; depth <= parts.length; depth++) {
      const entry = parts.slice(0, depth).join('/');
      const key = entry.toLowerCase();
      const variants = entries.get(key) ?? new Set();
      for (const previous of variants) {
        if (!variants.has(entry)) {
          clashes.add(`Path case clash: ${JSON.stringify(previous)} / ${JSON.stringify(entry)}`);
        }
      }
      variants.add(entry);
      entries.set(key, variants);
    }

    const { dir, name } = posix.parse(path);
    const key = `${dir}/${name.toLowerCase()}`;
    const variants = stems.get(key) ?? new Map();
    for (const [previousName, previousPath] of variants) {
      if (previousName !== name && previousPath.toLowerCase() !== path.toLowerCase()) {
        clashes.add(`Stem case clash: ${JSON.stringify(previousPath)} / ${JSON.stringify(path)}`);
      }
    }
    variants.set(name, path);
    stems.set(key, variants);
  }

  return [...clashes];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const paths = execFileSync('git', ['ls-files', '-z'], {
    cwd: new URL('../', import.meta.url),
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean);
  const clashes = findPathCaseClashes(paths);
  for (const clash of clashes) console.error(clash);
  if (clashes.length) process.exitCode = 1;
}
