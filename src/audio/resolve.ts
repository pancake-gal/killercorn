import manifest from '../../assets/audio/manifest.json';

export type CueKind = 'music' | 'sfx';

export interface CueEntry {
  id: string;
  kind: CueKind;
  path: string; // served path, relative to web root
}

interface AudioManifest {
  version: number;
  cues: CueEntry[];
}

const MANIFEST = manifest as AudioManifest;
const BY_ID = new Map(MANIFEST.cues.map((c) => [c.id, c]));

export function resolveCue(id: string): CueEntry | undefined {
  return BY_ID.get(id);
}

export function hasCue(id: string): boolean {
  return BY_ID.has(id);
}

export function cuePath(id: string): string {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`resolveCue: unknown cue id "${id}"`);
  return `${import.meta.env.BASE_URL}${entry.path.replace(/^\/+/, '')}`;
}

export function cuesOfKind(kind: CueKind): CueEntry[] {
  return MANIFEST.cues
    .filter((c) => c.kind === kind)
    .map((entry) => ({ ...entry, path: `${import.meta.env.BASE_URL}${entry.path.replace(/^\/+/, '')}` }));
}
