export interface PixelPatch {
  indices: number[];
  before: number[];
  after: number[];
}

export interface UndoState {
  undo: PixelPatch[];
  redo: PixelPatch[];
}

export function createUndoState(): UndoState {
  return { undo: [], redo: [] };
}

export function applyPatch(
  pixels: Uint32Array,
  patch: PixelPatch,
  direction: 'undo' | 'redo',
): void {
  const values = direction === 'undo' ? patch.before : patch.after;
  for (let i = 0; i < patch.indices.length; i += 1) {
    pixels[patch.indices[i]] = values[i];
  }
}

export function addPatch(
  state: UndoState,
  patch: PixelPatch,
  limit: number,
): UndoState {
  const nextUndo = [...state.undo, patch];
  if (nextUndo.length > limit) {
    nextUndo.shift();
  }
  return { undo: nextUndo, redo: [] };
}
