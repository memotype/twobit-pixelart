import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  BlendMode,
  Canvas,
  FilterMode,
  Image,
  MipmapMode,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  runOnJS,
  useSharedValue,
} from 'react-native-reanimated';

import type {
  HexColor,
  ProjectRuntime,
} from '../../lib/project/types';
import { parseHexColor } from '../../lib/project/palette';
import type { Theme } from '../../ui/theme';
import type {
  SkImage,
  SkPaint,
  SkSurface,
} from '@shopify/react-native-skia';

interface CanvasViewProps {
  project: ProjectRuntime;
  onStrokeStart: (index: number) => void;
  onStrokeSegment: (fromIndex: number, toIndex: number) => void;
  onStrokeEnd: () => void;
  theme: Theme;
  dirtyIndices: number[];
  dirtyVersion: number;
  fullRedrawToken: number;
}

interface LayoutSize {
  width: number;
  height: number;
}

function createPaint(color: HexColor): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(false);
  paint.setBlendMode(BlendMode.Src);
  paint.setColor(Skia.Color(color));
  return paint;
}

function createClearPaint(): SkPaint {
  const paint = Skia.Paint();
  paint.setAntiAlias(false);
  paint.setBlendMode(BlendMode.Clear);
  return paint;
}

export function CanvasView({
  project,
  onStrokeStart,
  onStrokeSegment,
  onStrokeEnd,
  theme,
  dirtyIndices,
  dirtyVersion,
  fullRedrawToken,
}: CanvasViewProps): React.ReactElement {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });
  const surfaceRef = useRef<SkSurface | null>(null);
  const paintsRef = useRef<SkPaint[]>([]);
  const clearPaintRef = useRef<SkPaint>(createClearPaint());
  const appliedRef = useRef({
    fullRedrawToken: -1,
    dirtyVersion: -1,
    paletteKey: '',
  });
  const activeSv = useSharedValue(false);
  const lastXsv = useSharedValue(-1);
  const lastYsv = useSharedValue(-1);

  const sampling = useMemo(
    () => ({ filter: FilterMode.Nearest, mipmap: MipmapMode.None }),
    [],
  );
  const paletteRgba = useMemo(
    () => project.palette.colors.map(parseHexColor),
    [project.palette.colors],
  );

  const ensureSurface = useCallback((): SkSurface | null => {
    const { width, height } = project.canvas;
    if (width <= 0 || height <= 0) {
      surfaceRef.current = null;
      return null;
    }
    const existing = surfaceRef.current;
    if (
      existing &&
      existing.width() === width &&
      existing.height() === height
    ) {
      return existing;
    }
    const next = Skia.Surface.Make(width, height);
    surfaceRef.current = next;
    return next;
  }, [project.canvas]);

  const drawPixel = useCallback(
    (index: number, canvas: ReturnType<SkSurface['getCanvas']>) => {
      const colorIndex = project.pixels[index];
      const color = paletteRgba[colorIndex] ?? paletteRgba[0];
      const x = index % project.canvas.width;
      const y = Math.floor(index / project.canvas.width);
      const rect = Skia.XYWHRect(x, y, 1, 1);
      if (color.a === 0) {
        canvas.drawRect(rect, clearPaintRef.current);
        return;
      }
      const paint = paintsRef.current[colorIndex] ?? paintsRef.current[0];
      canvas.drawRect(rect, paint);
    },
    [paletteRgba, project.canvas.width, project.pixels],
  );

  const image: SkImage | null = useMemo(() => {
    paintsRef.current = project.palette.colors.map(createPaint);
    const surface = ensureSurface();
    if (!surface) {
      return null;
    }
    const paletteKey = project.palette.colors.join(',');
    const canvas = surface.getCanvas();
    const fullRedrawNeeded =
      appliedRef.current.fullRedrawToken !== fullRedrawToken ||
      appliedRef.current.paletteKey !== paletteKey;
    if (fullRedrawNeeded) {
      canvas.clear(Skia.Color('#00000000'));
      for (let i = 0; i < project.pixels.length; i += 1) {
        drawPixel(i, canvas);
      }
      appliedRef.current = {
        fullRedrawToken,
        dirtyVersion,
        paletteKey,
      };
    } else if (
      appliedRef.current.dirtyVersion !== dirtyVersion &&
      dirtyIndices.length > 0
    ) {
      for (const index of dirtyIndices) {
        drawPixel(index, canvas);
      }
      appliedRef.current.dirtyVersion = dirtyVersion;
    }
    surface.flush();
    return surface.makeImageSnapshot();
  }, [
    dirtyIndices,
    dirtyVersion,
    drawPixel,
    ensureSurface,
    fullRedrawToken,
    project.palette.colors,
    project.pixels,
  ]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const { pixelSize, gridGap } = project.pixelGeometry;
  const logicalWidth = project.canvas.width * (pixelSize + gridGap) - gridGap;
  const logicalHeight =
    project.canvas.height * (pixelSize + gridGap) - gridGap;
  const scaleX = layout.width > 0 ? layout.width / logicalWidth : 1;
  const scaleY = layout.height > 0 ? layout.height / logicalHeight : 1;
  const scale = Math.max(4, Math.floor(Math.min(scaleX, scaleY)));
  const viewWidth = logicalWidth * scale;
  const viewHeight = logicalHeight * scale;
  const checkerSize = Math.max(6, Math.floor(scale * 2));
  const checkerLight =
    theme.scheme === 'dark' ? '#1f1f1f' : '#f4f4f4';
  const checkerDark = theme.scheme === 'dark' ? '#2a2a2a' : '#e6e6e6';
  const checkerRects = useMemo(() => {
    const cols = Math.ceil(viewWidth / checkerSize);
    const rows = Math.ceil(viewHeight / checkerSize);
    const rects: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
    }> = [];
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const isDark = (x + y) % 2 === 0;
        rects.push({
          x: x * checkerSize,
          y: y * checkerSize,
          w: checkerSize,
          h: checkerSize,
          color: isDark ? checkerDark : checkerLight,
        });
      }
    }
    return rects;
  }, [
    checkerDark,
    checkerLight,
    checkerSize,
    viewHeight,
    viewWidth,
  ]);

  const panGesture = useMemo(() => {
    const cell = pixelSize + gridGap;
    const step = cell * scale;
    const width = project.canvas.width;
    const height = project.canvas.height;
    return Gesture.Pan()
      .maxPointers(1)
      .onBegin((event) => {
        'worklet';
        const px = Math.floor(event.x / step);
        const py = Math.floor(event.y / step);
        if (px < 0 || py < 0 || px >= width || py >= height) {
          activeSv.value = false;
          return;
        }
        activeSv.value = true;
        lastXsv.value = px;
        lastYsv.value = py;
        runOnJS(onStrokeStart)(py * width + px);
      })
      .onUpdate((event) => {
        'worklet';
        if (!activeSv.value) {
          return;
        }
        const px = Math.floor(event.x / step);
        const py = Math.floor(event.y / step);
        if (px < 0 || py < 0 || px >= width || py >= height) {
          return;
        }
        if (px === lastXsv.value && py === lastYsv.value) {
          return;
        }
        const fromIndex = lastYsv.value * width + lastXsv.value;
        const toIndex = py * width + px;
        lastXsv.value = px;
        lastYsv.value = py;
        if (fromIndex !== toIndex) {
          runOnJS(onStrokeSegment)(fromIndex, toIndex);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (!activeSv.value) {
          return;
        }
        activeSv.value = false;
        runOnJS(onStrokeEnd)();
      });
  }, [
    activeSv,
    gridGap,
    lastXsv,
    lastYsv,
    onStrokeSegment,
    onStrokeEnd,
    onStrokeStart,
    pixelSize,
    project.canvas.height,
    project.canvas.width,
    scale,
  ]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background,
          borderColor: theme.colors.border,
        },
      ]}
      onLayout={handleLayout}
    >
      <GestureDetector gesture={panGesture}>
        <View
          style={[
            styles.canvas,
            {
              width: viewWidth,
              height: viewHeight,
              backgroundColor: project.canvas.background || 'transparent',
            },
          ]}
        >
          <Canvas style={{ width: viewWidth, height: viewHeight }}>
            {checkerRects.map((rect, index) => (
              <Rect
                key={`checker_${index}`}
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                color={rect.color}
              />
            ))}
            {image ? (
              <Image
                image={image}
                x={0}
                y={0}
                width={viewWidth}
                height={viewHeight}
                sampling={sampling}
              />
            ) : null}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  canvas: {
    backgroundColor: '#ffffff',
  },
});
