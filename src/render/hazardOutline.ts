// Thrown spiked corn must not read as a good cob. Its frames get a dark rim and a hot recolor, built
// once from the loaded images. Pure pixel math, so the result looks the same under Phaser's WebGL and
// Canvas renderers (tints are WebGL-only). Presentation only: nothing here touches the sim.

export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA, row-major
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const HAZARD_OUTLINE: Rgb = { r: 24, g: 12, b: 8 };
// Multiply tint that pushes the cob's yellow to a hot red-orange.
export const HAZARD_TINT: Rgb = { r: 255, g: 112, b: 84 };

const SOLID = 128; // alpha at or above this counts as body for the rim

// Returns a new image padded by `radius` on every side: the body recolored by `tint`, ringed by an
// opaque `outline` rim `radius` pixels wide (square dilation of the body mask).
export function outlineHazard(src: PixelImage, radius: number, outline: Rgb, tint: Rgb): PixelImage {
  const w = src.width + radius * 2;
  const h = src.height + radius * 2;

  const mask = new Uint8Array(w * h);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (src.data[(y * src.width + x) * 4 + 3]! >= SOLID) mask[(y + radius) * w + x + radius] = 1;
    }
  }

  // Separable square dilation: rows, then columns.
  const rows = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let d = -radius; d <= radius; d++) {
        const sx = x + d;
        if (sx >= 0 && sx < w && mask[y * w + sx]) { rows[y * w + x] = 1; break; }
      }
    }
  }
  const rim = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let d = -radius; d <= radius; d++) {
        const sy = y + d;
        if (sy >= 0 && sy < h && rows[sy * w + x]) { rim[y * w + x] = 1; break; }
      }
    }
  }

  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const sx = x - radius;
      const sy = y - radius;
      const inside = sx >= 0 && sx < src.width && sy >= 0 && sy < src.height;
      const i = (sy * src.width + sx) * 4;
      const a = inside ? src.data[i + 3]! : 0;
      const r = inside ? (src.data[i]! * tint.r) / 255 : 0;
      const g = inside ? (src.data[i + 1]! * tint.g) / 255 : 0;
      const b = inside ? (src.data[i + 2]! * tint.b) / 255 : 0;

      if (rim[y * w + x]) {
        // Recolored source over the opaque rim.
        const k = a / 255;
        data[o] = Math.round(r * k + outline.r * (1 - k));
        data[o + 1] = Math.round(g * k + outline.g * (1 - k));
        data[o + 2] = Math.round(b * k + outline.b * (1 - k));
        data[o + 3] = 255;
      } else if (a > 0) {
        data[o] = Math.round(r);
        data[o + 1] = Math.round(g);
        data[o + 2] = Math.round(b);
        data[o + 3] = a;
      }
    }
  }
  return { width: w, height: h, data };
}
