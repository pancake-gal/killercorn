// Browser storage is optional infrastructure. Browsers and embedded/privacy contexts may expose
// localStorage while throwing from individual operations, so callers use these small total
// functions and keep the current session alive when persistence is unavailable.

export interface StorageReader {
  getItem(key: string): string | null;
}

export interface StorageWriter {
  setItem(key: string, value: string): void;
}

export interface StorageRemover {
  removeItem(key: string): void;
}

export function readStorage(storage: StorageReader | null | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(storage: StorageWriter | null | undefined, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(storage: StorageRemover | null | undefined, key: string): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
