import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { ProjectRuntime } from '../../lib/project/types';
import { buildRenderRects } from '../../lib/render/pixelRects';

interface CanvasViewProps {
  project: ProjectRuntime;
  onStrokeStart: (index: number) => void;
  onStrokeMove: (index: number) => void;
  onStrokeEnd: () => void;
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
}: CanvasViewProps): React.ReactElement {
  const [layout, setLayout] = useState<LayoutSize>({ width: 0, height: 0 });
  const rects = useMemo(() => buildRenderRects(project), [project]);

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

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View
        style={[
          styles.canvas,
          {
            width: viewWidth,
            height: viewHeight,
            backgroundColor: project.canvas.background || '#ffffff',
          },
        ]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => {
          const index = hitTestIndex(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
          if (index >= 0) {
            onStrokeStart(index);
          }
        }}
        onResponderMove={(event) => {
          const index = hitTestIndex(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
          if (index >= 0) {
            onStrokeMove(index);
          }
        }}
        onResponderRelease={onStrokeEnd}
        onResponderTerminate={onStrokeEnd}
      >
        <Svg width={viewWidth} height={viewHeight}>
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
    backgroundColor: '#fafafa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
  },
  canvas: {
    backgroundColor: '#ffffff',
  },
});
