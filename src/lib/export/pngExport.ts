import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { ProjectRuntime } from '../project/types';
import { parseHexColor, isTransparent } from '../project/palette';
import { encodePngRgba, toBase64 } from './pngEncoding';

export type PngScale = 1 | 2 | 4 | 8;

function buildRgbaBuffer(
  project: ProjectRuntime,
  scale: PngScale,
): Uint8Array {
  const width = project.canvas.width;
  const height = project.canvas.height;
  const outWidth = width * scale;
  const outHeight = height * scale;
  const output = new Uint8Array(outWidth * outHeight * 4);
  const palette = project.palette.colors.map(parseHexColor);
  const transparentIndex = project.palette.colors.findIndex((color) =>
    isTransparent(color),
  );
  const transparent = transparentIndex === -1 ? 0 : transparentIndex;
  const background = project.canvas.background
    ? parseHexColor(project.canvas.background)
    : null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = project.pixels[y * width + x];
      const color =
        index === transparent && background ? background : palette[index];
      const alpha = index === transparent && !background ? 0 : color.a;
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const outX = x * scale + sx;
          const outY = y * scale + sy;
          const offset = (outY * outWidth + outX) * 4;
          output[offset] = color.r;
          output[offset + 1] = color.g;
          output[offset + 2] = color.b;
          output[offset + 3] = alpha;
        }
      }
    }
  }
  return output;
}

export async function exportPng(
  project: ProjectRuntime,
  scale: PngScale,
): Promise<string> {
  const width = project.canvas.width * scale;
  const height = project.canvas.height * scale;
  const pixels = buildRgbaBuffer(project, scale);
  const png = encodePngRgba(pixels, width, height);
  const base64 = toBase64(png);
  const filename = `${project.name.replace(/\s+/g, '_')}_${scale}x.png`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}

export async function sharePng(path: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(path, {
      mimeType: 'image/png',
      dialogTitle: 'Share PNG',
    });
  }
}
