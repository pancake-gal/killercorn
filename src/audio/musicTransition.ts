const clampFraction = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999, Math.max(0, value));
};

export function musicSeekSeconds(duration: number, fraction: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return duration * clampFraction(fraction);
}

export function musicPhaseFraction(duration: number, seek: number, fallback: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(seek)) return clampFraction(fallback);
  const wrapped = ((seek % duration) + duration) % duration;
  return clampFraction(wrapped / duration);
}
