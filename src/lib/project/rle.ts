import type { LayerPixelsRle } from './types';

export function encodeRle(pixels: Uint32Array): LayerPixelsRle {
  const runs: Array<[number, number]> = [];
  if (pixels.length === 0) {
    return { encoding: 'index_rle_v1', runs };
  }
  let current = pixels[0];
  let count = 1;
  for (let i = 1; i < pixels.length; i += 1) {
    const value = pixels[i];
    if (value === current) {
      count += 1;
    } else {
      runs.push([count, current]);
      current = value;
      count = 1;
    }
  }
  runs.push([count, current]);
  return { encoding: 'index_rle_v1', runs };
}

export function decodeRle(
  rle: LayerPixelsRle,
  expectedLength: number,
): Uint32Array {
  const output = new Uint32Array(expectedLength);
  let offset = 0;
  for (const [count, index] of rle.runs) {
    for (let i = 0; i < count; i += 1) {
      output[offset] = index;
      offset += 1;
    }
  }
  if (offset !== expectedLength) {
    throw new Error('RLE data length does not match canvas size.');
  }
  return output;
}
