export function freshRoyaleSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}
