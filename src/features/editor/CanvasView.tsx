import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { ProjectRuntime } from '../../lib/project/types';
import { buildRenderRects } from '../../lib/render/pixelRects';
import type { Theme } from '../../ui/theme';

interface CanvasViewProps {
  project: ProjectRuntime;
  onStrokeStart: (index: number) => void;
  onStrokeMove: (index: number) => void;
  onStrokeEnd: () => void;
  theme: Theme;
}

interface LayoutSize {
  width: number;
  height: number;
}

export function CanvasView({
  project,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  theme,
}: CanvasViewProps): React.ReactElement {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });
  const isDrawingRef = useRef(false);
  const canvasRef = useRef<View>(null);
  const originRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    ready: false,
  });
  const rects = useMemo(() => buildRenderRects(project), [project]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
    originRef.current = {
      ...originRef.current,
      width,
      height,
    };
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

  const hitTestIndex = (x: number, y: number): number => {
    const cell = pixelSize + gridGap;
    const pixelX = Math.floor(x / (cell * scale));
    const pixelY = Math.floor(y / (cell * scale));
    if (
      pixelX < 0 ||
      pixelX >= project.canvas.width ||
      pixelY < 0 ||
      pixelY >= project.canvas.height
    ) {
      return -1;
    }
    return pixelY * project.canvas.width + pixelX;
  };

  const resolveOrigin = () => {
    if (!canvasRef.current) {
      return;
    }
    canvasRef.current.measureInWindow((x, y, width, height) => {
      originRef.current = {
        x,
        y,
        width,
        height,
        ready: true,
      };
    });
  };

  const handleStrokeMove = (pageX: number, pageY: number) => {
    if (!isDrawingRef.current) {
      return;
    }
    if (!originRef.current.ready) {
      resolveOrigin();
      return;
    }
    const localX = pageX - originRef.current.x;
    const localY = pageY - originRef.current.y;
    if (
      localX < 0 ||
      localY < 0 ||
      localX > originRef.current.width ||
      localY > originRef.current.height
    ) {
      return;
    }
    const index = hitTestIndex(localX, localY);
    if (index >= 0) {
      onStrokeMove(index);
    }
  };

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
      <View
      style={[
        styles.canvas,
        {
          width: viewWidth,
          height: viewHeight,
          backgroundColor: project.canvas.background || 'transparent',
        },
      ]}
      ref={canvasRef}
      onStartShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        resolveOrigin();
        const localX =
          event.nativeEvent.pageX - originRef.current.x;
        const localY =
          event.nativeEvent.pageY - originRef.current.y;
        const index = hitTestIndex(localX, localY);
        if (index >= 0) {
          isDrawingRef.current = true;
          onStrokeStart(index);
        }
      }}
      onResponderMove={(event) => {
        handleStrokeMove(
          event.nativeEvent.pageX,
          event.nativeEvent.pageY,
        );
      }}
        onResponderRelease={() => {
          isDrawingRef.current = false;
          onStrokeEnd();
        }}
        onResponderTerminate={() => {
          isDrawingRef.current = false;
          onStrokeEnd();
        }}
      >
        <Svg width={viewWidth} height={viewHeight}>
          {checkerRects.map((rect, index) => (
            <Rect
              key={`checker_${index}`}
              x={rect.x}
              y={rect.y}
              width={rect.w}
              height={rect.h}
              fill={rect.color}
            />
          ))}
          {rects.map((rect, index) => (
            <Rect
              key={`${rect.color}_${index}`}
              x={rect.x * scale}
              y={rect.y * scale}
              width={rect.w * scale}
              height={rect.h * scale}
              fill={rect.color}
            />
          ))}
        </Svg>
      </View>
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
