import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

export async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const file = `${prefix}${entry.name}`;
    return entry.isDirectory() ? listFiles(path.join(directory, entry.name), `${file}/`) : [file];
  }));
  return nested.flat().sort();
}

export function shouldPrecache(file) {
  return file === 'index.html'
    || /\.(?:js|css|woff2?|ttf|otf|mp3|ogg|wav)$/i.test(file)
    || /^locales\/.*\.json$/.test(file);
}

export default function serviceWorkerPlugin() {
  let config;
  return {
    name: 'webatrice-service-worker',
    apply: 'build',
    configResolved(resolved) {
      config = resolved;
    },
    async closeBundle() {
      const directory = path.resolve(config.root, config.build.outDir);
      const files = (await listFiles(directory)).filter((file) => !['sw.js', 'sw-manifest.json'].includes(file));
      const base = new URL(config.base, 'https://build.invalid').pathname;
      const hash = createHash('sha256').update(base);
      const workerEntry = fileURLToPath(new URL('../src/services/serviceWorker/worker.ts', import.meta.url));
      hash.update(await readFile(workerEntry));
      hash.update(await readFile(new URL('../src/services/serviceWorker/policy.ts', import.meta.url)));
      const precache = files.filter(shouldPrecache);
      let bytes = 0;
      for (const file of files) {
        const content = await readFile(path.join(directory, file));
        hash.update(file).update(content);
        if (precache.includes(file)) {
          bytes += content.byteLength;
        }
      }
      const manifest = {
        base, hash: hash.digest('hex').slice(0, 16), bytes,
        precache: precache.map((file) => `${base}${file}`),
        publicFiles: files.filter((file) => !file.startsWith('assets/') && file !== 'index.html')
          .map((file) => `${base}${file}`),
      };
      const result = await build({
        configFile: false,
        root: config.root,
        publicDir: false,
        logLevel: 'error',
        define: { __SW_MANIFEST__: JSON.stringify(manifest) },
        build: {
          write: false,
          target: config.build.target,
          lib: {
            entry: workerEntry,
            formats: ['iife'], name: 'WebatriceServiceWorker',
          },
        },
      });
      const output = (Array.isArray(result) ? result[0] : result).output;
      const worker = output.find((entry) => entry.type === 'chunk');
      if (!worker) {
        throw new Error('Service worker build did not emit a chunk');
      }
      await writeFile(path.join(directory, 'sw.js'), worker.code);
      await writeFile(path.join(directory, 'sw-manifest.json'), JSON.stringify(manifest, null, 2));
      config.logger.info(`Service worker precache: ${precache.length} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB (uncompressed)`);
    },
  };
}
