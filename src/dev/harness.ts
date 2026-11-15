export interface DevMount {
  harness: boolean; // dev harness explicitly enabled
  scene: string | null; // scene/view to mount directly, or null for normal boot
  bare: boolean; // strip surrounding chrome
  level: string | null; // campaign level id to mount into PlayScene (e.g. '1-boss'), or null for default
}

export function parseDevMount(search: string = location.search): DevMount {
  const params = new URLSearchParams(search);
  return {
    harness: params.get('harness') === '1',
    scene: params.get('dev'),
    bare: params.get('bare') === 'true',
    level: params.get('level'),
  };
}

// A direct scene mount only counts when the harness gate is set — defense against a stray
// ?dev= in a shared link changing what a normal player sees.
export function activeMount(search: string = location.search): DevMount {
  if (!import.meta.env.DEV) return { harness: false, scene: null, bare: false, level: null };
  const mount = parseDevMount(search);
  if (!mount.harness) return { harness: false, scene: null, bare: false, level: null };
  return mount;
}
