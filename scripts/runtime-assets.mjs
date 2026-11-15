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
