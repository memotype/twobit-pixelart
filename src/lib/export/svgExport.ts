import * as FileSystem from 'expo-file-system/legacy';

import type { ProjectRuntime } from '../project/types';
import { isTransparent } from '../project/palette';
import { mergeRects } from '../project/mergeRects';

function formatNumber(value: number): string {
  const fixed = value.toFixed(4);
  return fixed.replace(/\.?0+$/, '');
}

interface SvgRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

function buildRects(project: ProjectRuntime): SvgRect[] {
  const { width, height } = project.canvas;
  const { pixelSize, gridGap, bleed } = project.pixelGeometry;
  const step = pixelSize + gridGap;
  const rects: SvgRect[] = [];
  const palette = project.palette.colors;
  const transparentIndex = palette.findIndex((color) => isTransparent(color));
  const transparent = transparentIndex === -1 ? 0 : transparentIndex;

  if (gridGap > 0) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = project.pixels[y * width + x];
        const color = palette[index];
        if (index !== transparent) {
          rects.push({
            x: x * step,
            y: y * step,
            w: pixelSize,
            h: pixelSize,
            color,
          });
        }
      }
    }
    return rects.map((rect) => ({
      ...rect,
      x: rect.x - bleed / 2,
      y: rect.y - bleed / 2,
      w: rect.w + bleed,
      h: rect.h + bleed,
    }));
  }

  const merged = mergeRects(project.pixels, width, height, transparent);
  return merged.map((rect) => ({
    x: rect.x * step - bleed / 2,
    y: rect.y * step - bleed / 2,
    w: rect.w * step + bleed,
    h: rect.h * step + bleed,
    color: palette[rect.colorIndex],
  }));
}

export function exportSvg(project: ProjectRuntime): string {
  const { width, height } = project.canvas;
  const { pixelSize, gridGap } = project.pixelGeometry;
  const step = pixelSize + gridGap;
  const svgWidth = width * step - gridGap;
  const svgHeight = height * step - gridGap;
  const rects = buildRects(project);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${formatNumber(svgWidth)}" ` +
      `height="${formatNumber(svgHeight)}" ` +
      `viewBox="0 0 ${formatNumber(svgWidth)} ` +
      `${formatNumber(svgHeight)}" ` +
      'shape-rendering="crispEdges">',
  );
  lines.push('  <g>');
  if (project.canvas.background) {
    lines.push(
      `    <rect x="0" y="0" width="${formatNumber(svgWidth)}" ` +
        `height="${formatNumber(svgHeight)}" ` +
        `fill="${project.canvas.background}"/>`,
    );
  }
  for (const rect of rects) {
    lines.push(
      `    <rect x="${formatNumber(rect.x)}" ` +
        `y="${formatNumber(rect.y)}" ` +
        `width="${formatNumber(rect.w)}" ` +
        `height="${formatNumber(rect.h)}" ` +
        `fill="${rect.color}"/>`,
    );
  }
  lines.push('  </g>');
  lines.push('</svg>');
  return lines.join('\n');
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return 'pixel_forge';
  }
  return trimmed.replace(/\s+/g, '_');
}

export async function exportSvgFile(
  project: ProjectRuntime,
): Promise<string> {
  const svg = exportSvg(project);
  const filename = `${sanitizeFilename(project.name)}.svg`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, svg);
  return path;
}
