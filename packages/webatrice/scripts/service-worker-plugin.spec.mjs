// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { shouldPrecache } from './service-worker-plugin.mjs';
import { checkServiceWorkerBuild } from './check-service-worker-build.mjs';

describe('service worker build', () => {
  it('selects boot resources, fonts, locales and sounds without precaching flags or source maps', () => {
    for (const file of ['index.html', 'assets/boot-12345678.js', 'assets/app-12345678.css',
      'assets/font-12345678.woff2', 'locales/en.json', 'sounds/Default/tap.wav', 'preflight.js']) {
      expect(shouldPrecache(file)).toBe(true);
    }
    for (const file of ['assets/us-12345678.svg', 'assets/app-12345678.js.map', 'logo192.png', 'version.txt']) {
      expect(shouldPrecache(file)).toBe(false);
    }
  });

  it('emits a worker matching real Vite output and changes the build hash when public contents change', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'webatrice-sw-'));
    try {
      await mkdir(path.join(root, 'public/locales'), { recursive: true });
      await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
      await writeFile(path.join(root, 'main.js'), 'document.body.textContent = "app";');
      await writeFile(path.join(root, 'public/locales/en.json'), '{"hello":"Hello"}');
      const options = {
        root, configFile: false, base: '/Webatrice/', logLevel: 'silent',
        build: { outDir: 'build' },
      };
      const buildFixture = () => promisify(execFile)(process.execPath, ['--input-type=module', '-e', `
        import { build } from 'vite';
        import plugin from ${JSON.stringify(new URL('./service-worker-plugin.mjs', import.meta.url).href)};
        await build({ ...${JSON.stringify(options)}, plugins: [plugin()] });
      `]);
      await buildFixture();
      const first = await checkServiceWorkerBuild(path.join(root, 'build'), '/Webatrice/');
      expect(first.precache).toContain('/Webatrice/locales/en.json');
      expect(first.precache.some((file) => /^\/Webatrice\/assets\/index-.+\.js$/.test(file))).toBe(true);
      await writeFile(path.join(root, 'public/locales/en.json'), '{"hello":"Changed"}');
      await buildFixture();
      const second = await checkServiceWorkerBuild(path.join(root, 'build'), '/Webatrice/');
      expect(second.hash).not.toBe(first.hash);
      const manifestPath = path.join(root, 'build/sw-manifest.json');
      const broken = JSON.parse(await readFile(manifestPath, 'utf8'));
      broken.precache.pop();
      await writeFile(manifestPath, JSON.stringify(broken));
      await expect(checkServiceWorkerBuild(path.join(root, 'build'), '/Webatrice/')).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
