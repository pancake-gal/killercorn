export const ROYALE_SPICES = ['soloKid', 'noCrew', 'oneLife', 'noSecondWind', 'shuffle'] as const;

export type RoyaleSpice = (typeof ROYALE_SPICES)[number];
export type RoyaleSpices = Readonly<Record<RoyaleSpice, boolean>>;

export const NO_SPICES: RoyaleSpices = { soloKid: false, noCrew: false, oneLife: false, noSecondWind: false, shuffle: false };

export function spiceCount(spices: RoyaleSpices): number {
  return ROYALE_SPICES.filter((spice) => spices[spice]).length;
}
