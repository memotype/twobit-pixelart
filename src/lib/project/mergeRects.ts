export interface MergedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number;
}

interface RowRun {
  x: number;
  w: number;
  colorIndex: number;
}

function buildRowRuns(
  pixels: Uint32Array,
  width: number,
  row: number,
  transparentIndex: number,
): RowRun[] {
  const runs: RowRun[] = [];
  const offset = row * width;
  let current = pixels[offset];
  let start = 0;
  for (let x = 1; x < width; x += 1) {
    const value = pixels[offset + x];
    if (value !== current) {
      if (current !== transparentIndex) {
        runs.push({
          x: start,
          w: x - start,
          colorIndex: current,
        });
      }
      current = value;
      start = x;
    }
  }
  if (current !== transparentIndex) {
    runs.push({
      x: start,
      w: width - start,
      colorIndex: current,
    });
  }
  return runs;
}

export function mergeRects(
  pixels: Uint32Array,
  width: number,
  height: number,
  transparentIndex: number,
): MergedRect[] {
  const output: MergedRect[] = [];
  const active = new Map<string, MergedRect>();

  const flushMissing = (rowRuns: RowRun[]) => {
    const keys = new Set(
      rowRuns.map((run) => `${run.x}:${run.w}:${run.colorIndex}`),
    );
    for (const [key, rect] of active.entries()) {
      if (!keys.has(key)) {
        output.push(rect);
        active.delete(key);
      }
    }
  };

  for (let y = 0; y < height; y += 1) {
    const rowRuns = buildRowRuns(pixels, width, y, transparentIndex);
    flushMissing(rowRuns);
    for (const run of rowRuns) {
      const key = `${run.x}:${run.w}:${run.colorIndex}`;
      const existing = active.get(key);
      if (existing) {
        existing.h += 1;
      } else {
        active.set(key, {
          x: run.x,
          y,
          w: run.w,
          h: 1,
          colorIndex: run.colorIndex,
        });
      }
    }
  }

  for (const rect of active.values()) {
    output.push(rect);
  }

  return output;
}
