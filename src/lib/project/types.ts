export type HexColor = `#${string}`;

export type PixelEncoding = 'index_rle_v1';

export interface CanvasSpec {
  width: number;
  height: number;
  background: HexColor | null;
}

export interface PixelGeometry {
  pixelSize: number;
  gridGap: number;
  bleed: number;
}

export interface PaletteSpec {
  format: 'rgba8888';
  colors: HexColor[];
}

export interface LayerPixelsRle {
  encoding: PixelEncoding;
  runs: Array<[number, number]>;
}

export interface LayerSpec {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: 'normal';
  pixels: LayerPixelsRle;
}

export interface ProjectMeta {
  createdAt: string;
  updatedAt: string;
  app: {
    name: string;
    version: string;
  };
}

export interface ProjectYaml {
  schemaVersion: number;
  id: string;
  name: string;
  canvas: CanvasSpec;
  pixelGeometry: PixelGeometry;
  palette: PaletteSpec;
  layers: LayerSpec[];
  meta: ProjectMeta;
  extensions?: Record<string, unknown>;
}

export interface ProjectRuntime {
  id: string;
  name: string;
  canvas: CanvasSpec;
  pixelGeometry: PixelGeometry;
  palette: PaletteSpec;
  layerId: string;
  pixels: Uint32Array;
  meta: ProjectMeta;
}

export interface ProjectSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: string;
}
