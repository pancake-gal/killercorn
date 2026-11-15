export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force to uint32 so the stream is identical across platforms.
    this.state = seed >>> 0;
  }

  // mulberry32 — small, fast, fully deterministic; good enough for game jitter.
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Integer in [min, max].
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Uniform in [min, max).
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[this.int(0, items.length - 1)]!;
  }

  // Snapshot/restore the stream position so a replay can resume mid-run deterministically.
  snapshot(): number {
    return this.state;
  }

  restore(state: number): void {
    this.state = state >>> 0;
  }
}
