import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync, createReadStream } from 'node:fs';
import { extname, resolve } from 'node:path';
import type { Plugin } from 'vite';
// @ts-ignore project-owned plain ESM helper shared with the packaging test
import { runtimeAssetPaths, hashedRuntimeAssets, rewriteAssetPaths } from './scripts/runtime-assets.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const ASSET_MANIFEST = JSON.parse(readFileSync(resolve(ROOT, 'assets/manifest.json'), 'utf8'));
const AUDIO_MANIFEST = JSON.parse(readFileSync(resolve(ROOT, 'assets/audio/manifest.json'), 'utf8'));
const RUNTIME_ASSETS: string[] = runtimeAssetPaths(ASSET_MANIFEST, AUDIO_MANIFEST);
// The home-screen manifest is served from the game root, so its relative start_url, scope, and icon
// paths cover the whole game (/ in dev, /play/ when published).
const APP_MANIFEST_SOURCE = 'assets/app.webmanifest';
const APP_MANIFEST_FILE = 'app.webmanifest';

const MIME: Record<string, string> = {
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function runtimeAssetsPlugin(): Plugin {
  const allowed = new Set(RUNTIME_ASSETS);
  // Served name per runtime path. Builds content-hash art and audio so the host can cache them
  // immutably (GO-LIVE-PUBLICATION host configuration); dev keeps the plain paths.
  let served: Map<string, string> = new Map(RUNTIME_ASSETS.map((path) => [path, path]));
  return {
    name: 'killercorn-runtime-assets',
    enforce: 'pre',
    configResolved(config) {
      if (config.command === 'build') {
        served = hashedRuntimeAssets(RUNTIME_ASSETS, (path: string) => readFileSync(resolve(ROOT, path)));
      }
    },
    transform(code, id) {
      if (!/\/assets\/(audio\/)?manifest\.json$/.test(id.split('?')[0])) return null;
      return { code: rewriteAssetPaths(code, served), map: null };
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname).replace(/^\/+/, '');
        const source = pathname === APP_MANIFEST_FILE ? APP_MANIFEST_SOURCE : allowed.has(pathname) ? pathname : null;
        if (!source) return next();
        response.setHeader('Content-Type', MIME[extname(pathname)] ?? 'application/octet-stream');
        response.setHeader('Cache-Control', 'public, max-age=3600');
        createReadStream(resolve(ROOT, source)).on('error', next).pipe(response);
      });
    },
    buildStart() {
      for (const fileName of RUNTIME_ASSETS) {
        this.emitFile({ type: 'asset', fileName: served.get(fileName) ?? fileName, source: readFileSync(resolve(ROOT, fileName)) });
      }
      this.emitFile({ type: 'asset', fileName: APP_MANIFEST_FILE, source: readFileSync(resolve(ROOT, APP_MANIFEST_SOURCE)) });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [react(), runtimeAssetsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5300,
    strictPort: true,
  },
  preview: {
    port: 5301,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser';
          if (id.includes('/node_modules/react') || id.includes('/node_modules/scheduler/')) return 'react';
        },
      },
    },
  },
});
