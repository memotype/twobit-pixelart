import type {
  CanvasSpec,
  PaletteSpec,
  PixelGeometry,
  ProjectRuntime,
  ProjectYaml,
} from './types';
import { decodeRle, encodeRle } from './rle';

const APP_NAME = 'Pixel Forge';
const APP_VERSION = '0.1.0';

const DEFAULT_PALETTE: PaletteSpec = {
  format: 'rgba8888',
  colors: [
    '#00000000',
    '#111111FF',
    '#FFFFFFFF',
    '#FF3B30FF',
    '#34C759FF',
    '#007AFFFF',
    '#FFD60AFF',
    '#AF52DEFF',
  ],
};

const DEFAULT_GEOMETRY: PixelGeometry = {
  pixelSize: 1,
  gridGap: 0,
  bleed: 0,
};

function nowIso(): string {
  return new Date().toISOString();
}

export function createProjectId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `proj_${stamp}_${rand}`;
}

export function createNewProject(
  name: string,
  width: number,
  height: number,
): ProjectRuntime {
  const id = createProjectId();
  const canvas: CanvasSpec = {
    width,
    height,
    background: null,
  };
  const meta = {
    createdAt: nowIso(),
    updatedAt: nowIso(),
    app: {
      name: APP_NAME,
      version: APP_VERSION,
    },
  };
  return {
    id,
    name,
    canvas,
    pixelGeometry: { ...DEFAULT_GEOMETRY },
    palette: { ...DEFAULT_PALETTE, colors: [...DEFAULT_PALETTE.colors] },
    layerId: `layer_${id}`,
    pixels: new Uint32Array(width * height),
    meta,
  };
}

export function projectToYaml(project: ProjectRuntime): ProjectYaml {
  const pixelCount = project.canvas.width * project.canvas.height;
  const pixels = project.pixels.length === pixelCount
    ? project.pixels
    : new Uint32Array(pixelCount);
  const layer = {
    id: project.layerId,
    name: 'Layer 1',
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    pixels: encodeRle(pixels),
  };
  return {
    schemaVersion: 1,
    id: project.id,
    name: project.name,
    canvas: project.canvas,
    pixelGeometry: project.pixelGeometry,
    palette: project.palette,
    layers: [layer],
    meta: {
      ...project.meta,
      updatedAt: nowIso(),
    },
    extensions: {},
  };
}

export function projectFromYaml(data: ProjectYaml): ProjectRuntime {
  const layer = data.layers[0];
  const pixelCount = data.canvas.width * data.canvas.height;
  const pixels = decodeRle(layer.pixels, pixelCount);
  return {
    id: data.id,
    name: data.name,
    canvas: data.canvas,
    pixelGeometry: data.pixelGeometry,
    palette: data.palette,
    layerId: layer.id,
    pixels,
    meta: data.meta,
  };
}
