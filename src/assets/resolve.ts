import manifest from '../../assets/manifest.json';

export type AssetKind = 'poster' | 'gameplay' | 'ui';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  path: string; // served path, relative to web root
}

interface Manifest {
  version: number;
  assets: AssetEntry[];
}

const MANIFEST = manifest as Manifest;
const BY_ID = new Map(MANIFEST.assets.map((a) => [a.id, a]));

export function resolveAsset(id: string): AssetEntry | undefined {
  return BY_ID.get(id);
}

export function assetPath(id: string): string {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`resolveAsset: unknown asset id "${id}"`);
  return `${import.meta.env.BASE_URL}${entry.path.replace(/^\/+/, '')}`;
}

export function assetsOfKind(kind: AssetKind): AssetEntry[] {
  return MANIFEST.assets
    .filter((a) => a.kind === kind)
    .map((entry) => ({ ...entry, path: `${import.meta.env.BASE_URL}${entry.path.replace(/^\/+/, '')}` }));
}
