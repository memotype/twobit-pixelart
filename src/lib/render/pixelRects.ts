import type { ProjectRuntime } from '../project/types';
import { isTransparent } from '../project/palette';
import { mergeRects } from '../project/mergeRects';

export interface RenderRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface BuildOptions {
  merge?: boolean;
}

export function buildRenderRects(
  project: ProjectRuntime,
  options: BuildOptions = {},
): RenderRect[] {
  const { merge = true } = options;
  const { width, height } = project.canvas;
  const { pixelSize, gridGap, bleed } = project.pixelGeometry;
  const step = pixelSize + gridGap;
  const palette = project.palette.colors;
  const transparentIndex = palette.findIndex((color) => isTransparent(color));
  const transparent = transparentIndex === -1 ? 0 : transparentIndex;
  const rects: RenderRect[] = [];

  if (gridGap > 0 || !merge) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = project.pixels[y * width + x];
        if (index !== transparent) {
          rects.push({
            x: x * step - bleed / 2,
            y: y * step - bleed / 2,
            w: pixelSize + bleed,
            h: pixelSize + bleed,
            color: palette[index],
          });
        }
      }
    }
    return rects;
  }

  const merged = mergeRects(project.pixels, width, height, transparent);
  for (const rect of merged) {
    rects.push({
      x: rect.x * step - bleed / 2,
      y: rect.y * step - bleed / 2,
      w: rect.w * step + bleed,
      h: rect.h * step + bleed,
      color: palette[rect.colorIndex],
    });
  }
  return rects;
}
