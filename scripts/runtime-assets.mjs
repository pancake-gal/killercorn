import { createHash } from 'node:crypto';

function cleanRuntimePath(path) {
  const clean = String(path).replace(/^\/+/, '');
  if (!clean.startsWith('assets/') || clean.includes('..')) {
    throw new Error(`Unsafe runtime asset path: ${String(path)}`);
  }
  return clean;
}

export function runtimeAssetPaths(assetManifest, audioManifest) {
  const paths = [
    ...(assetManifest.assets ?? []).map((entry) => cleanRuntimePath(entry.path)),
    ...(audioManifest.cues ?? []).map((entry) => cleanRuntimePath(entry.path)),
  ];
  const unique = [...new Set(paths)];
  if (unique.length !== paths.length) throw new Error('Runtime asset manifests contain duplicate paths');
  if (unique.some((path) => !/\.(webp|png|wav|svg|ico)$/i.test(path))) {
    throw new Error('Runtime asset allow-list contains a non-runtime file type');
  }
  return unique;
}

// `dir/name.ext` -> `dir/name.<8 hex of sha256(bytes)>.ext`, so a build can cache art and audio forever
// and a changed file always gets a new URL.
export function hashedAssetPath(path, bytes) {
  const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  const dot = path.lastIndexOf('.');
  return `${path.slice(0, dot)}.${hash}${path.slice(dot)}`;
}

// Icons stay at stable paths: index.html and the home-screen manifest name them literally.
const STABLE_PREFIX = 'assets/icons/';

export function hashedRuntimeAssets(paths, readBytes) {
  return new Map(paths.map((path) => [path, path.startsWith(STABLE_PREFIX) ? path : hashedAssetPath(path, readBytes(path))]));
}

// Swap each quoted manifest path ("/assets/x" or "assets/x") for its hashed name. Only whole quoted
// strings change, so a path that merely starts with a runtime path is left alone.
export function rewriteAssetPaths(code, map) {
  return code.replace(/"(\/?)(assets\/[^"]+)"/g, (match, slash, path) => {
    const hashed = map.get(path);
    return hashed ? `"${slash}${hashed}"` : match;
  });
}
