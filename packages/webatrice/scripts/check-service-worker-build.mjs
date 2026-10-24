import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listFiles, shouldPrecache } from './service-worker-plugin.mjs';

export async function checkServiceWorkerBuild(directory, base) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'sw-manifest.json'), 'utf8'));
  const worker = await readFile(path.join(directory, 'sw.js'), 'utf8');
  assert.equal(manifest.base, base);
  const files = (await listFiles(directory)).filter((file) => !['sw.js', 'sw-manifest.json'].includes(file));
  assert.deepEqual(manifest.precache, files.filter(shouldPrecache).map((file) => `${base}${file}`));
  assert.deepEqual(manifest.publicFiles, files.filter((file) => !file.startsWith('assets/') && file !== 'index.html')
    .map((file) => `${base}${file}`));
  let bytes = 0;
  for (const url of manifest.precache) {
    assert.ok(url.startsWith(base));
    bytes += (await readFile(path.join(directory, url.slice(base.length)))).byteLength;
    assert.ok(worker.includes(url), `Worker is missing ${url}`);
  }
  assert.equal(manifest.bytes, bytes);
  assert.match(manifest.hash, /^[a-f0-9]{16}$/);
  assert.ok(worker.includes(manifest.hash));
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const manifest = await checkServiceWorkerBuild(path.resolve(process.argv[2] || 'build'), process.argv[3] || '/Webatrice/');
  console.log(`Verified ${manifest.precache.length} precached files, ${manifest.bytes} bytes, build ${manifest.hash}`);
}
