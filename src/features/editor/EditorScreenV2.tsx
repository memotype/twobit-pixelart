import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';

import type { ProjectRuntime } from '../../lib/project/types';
import { isTransparent, parseHexColor } from '../../lib/project/palette';
import type { HexColor } from '../../lib/project/types';
import {
  deleteProject,
  deleteWorkingCopy,
  saveProjectExplicit,
  saveWorkingCopy,
} from '../../lib/storage/projectStorage';
import { exportSvgFile } from '../../lib/export/svgExport';
import { exportPng, sharePng, type PngScale } from '../../lib/export/pngExport';
import { CanvasView } from './CanvasView';
import { addPatch, applyPatch, createUndoState } from './undo';
import { useAutosave } from './useAutosave';
import type { Theme } from '../../ui/theme';

interface EditorScreenProps {
  project: ProjectRuntime;
  onExit: () => void;
  theme: Theme;
  topInset: number;
  isNewProject: boolean;
  isRestoredWorkingCopy: boolean;
}

interface StrokeState {
  indices: number[];
  before: number[];
  after: number[];
  seen: Set<number>;
}

const AUTOSAVE_DELAY_MS = 1200;
const UNDO_LIMIT = 100;
const RAIL_SIDE: 'left' | 'right' = 'right';

function* lineIndices(
  fromIndex: number,
  toIndex: number,
  width: number,
): Generator<number> {
  const fromX = fromIndex % width;
  const fromY = Math.floor(fromIndex / width);
  const toX = toIndex % width;
  const toY = Math.floor(toIndex / width);
  let x = fromX;
  let y = fromY;
  const dx = Math.abs(toX - fromX);
  const sx = fromX < toX ? 1 : -1;
  const dy = -Math.abs(toY - fromY);
  const sy = fromY < toY ? 1 : -1;
  let error = dx + dy;
  while (true) {
    yield y * width + x;
    if (x === toX && y === toY) {
      break;
    }
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }
}

function findOpaqueRedIndex(colors: HexColor[]): number {
  for (let i = 0; i < colors.length; i += 1) {
    const color = parseHexColor(colors[i]);
    if (
      color.r === 255 &&
      color.g === 59 &&
      color.b === 48 &&
      color.a === 255
    ) {
      return i;
    }
  }
  return -1;
}

function findFirstOpaqueIndex(colors: HexColor[]): number {
  for (let i = 0; i < colors.length; i += 1) {
    const color = parseHexColor(colors[i]);
    if (color.a > 0) {
      return i;
    }
  }
  return 0;
}

export function EditorScreenV2({
  project,
  onExit,
  theme,
  topInset,
  isNewProject,
  isRestoredWorkingCopy,
}: EditorScreenProps): React.ReactElement {
  const defaultIndex = useMemo(() => {
    const redIndex = findOpaqueRedIndex(project.palette.colors);
    if (redIndex !== -1) {
      return redIndex;
    }
    return findFirstOpaqueIndex(project.palette.colors);
  }, [project.palette.colors]);
  const [tool, setTool] = useState<'pencil' | 'eraser'>('pencil');
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  const [undoState, setUndoState] = useState(createUndoState());
  const [isDirty, setIsDirty] = useState(isRestoredWorkingCopy);
  const [isSessionNew, setIsSessionNew] = useState(isNewProject);
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const [dirtyBatch, setDirtyBatch] = useState({
    version: 0,
    indices: [] as number[],
  });
  const [fullRedrawToken, setFullRedrawToken] = useState(0);
  const [pixels, setPixels] = useState<Uint32Array>(
    () => new Uint32Array(project.pixels),
  );
  const strokeRef = useRef<StrokeState | null>(null);
  const pixelsRef = useRef<Uint32Array>(pixels);
  const dirtyIndicesRef = useRef<Set<number>>(new Set());
  const pendingPixelsRef = useRef<Uint32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const promptOpenRef = useRef(false);

  useEffect(() => {
    pixelsRef.current = pixels;
  }, [pixels]);

  const transparentIndex = useMemo(() => {
    const index = project.palette.colors.findIndex((color) =>
      isTransparent(color),
    );
    return index === -1 ? 0 : index;
  }, [project.palette.colors]);

  const renderProject = useMemo(
    () => ({ ...project, pixels }),
    [project, pixels],
  );

  const autosave = useAutosave(async () => {
    await saveWorkingCopy(renderProject);
  }, AUTOSAVE_DELAY_MS);

  const flushPendingPixels = useCallback(() => {
    if (!pendingPixelsRef.current) {
      return;
    }
    const next = pendingPixelsRef.current;
    pendingPixelsRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pixelsRef.current = next;
    setPixels(next);
    const indices = Array.from(dirtyIndicesRef.current);
    dirtyIndicesRef.current.clear();
    if (indices.length === 0) {
      setFullRedrawToken((prev) => prev + 1);
      return;
    }
    setDirtyBatch((prev) => ({
      version: prev.version + 1,
      indices,
    }));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushPendingPixels();
    });
  }, [flushPendingPixels]);

  const getActivePixels = useCallback(() => {
    return pendingPixelsRef.current ?? pixelsRef.current;
  }, []);

  const applyPixel = useCallback(
    (index: number, value: number) => {
      const base = getActivePixels();
      if (!pendingPixelsRef.current) {
        pendingPixelsRef.current = new Uint32Array(base);
      }
      pendingPixelsRef.current[index] = value;
      dirtyIndicesRef.current.add(index);
      scheduleFlush();
    },
    [getActivePixels, scheduleFlush],
  );

  const handleStrokeStart = useCallback(
    (index: number) => {
      strokeRef.current = {
        indices: [],
        before: [],
        after: [],
        seen: new Set(),
      };
      const paintValue = tool === 'eraser' ? transparentIndex : selectedIndex;
      const stroke = strokeRef.current;
      if (!stroke.seen.has(index)) {
        const activePixels = getActivePixels();
        stroke.seen.add(index);
        stroke.indices.push(index);
        stroke.before.push(activePixels[index]);
        stroke.after.push(paintValue);
      }
      applyPixel(index, paintValue);
    },
    [applyPixel, getActivePixels, selectedIndex, tool, transparentIndex],
  );

  const handleStrokeMove = useCallback(
    (index: number) => {
      const stroke = strokeRef.current;
      if (!stroke) {
        return;
      }
      const paintValue = tool === 'eraser' ? transparentIndex : selectedIndex;
      if (stroke.seen.has(index)) {
        return;
      }
      const activePixels = getActivePixels();
      stroke.seen.add(index);
      stroke.indices.push(index);
      stroke.before.push(activePixels[index]);
      stroke.after.push(paintValue);
      applyPixel(index, paintValue);
    },
    [applyPixel, getActivePixels, selectedIndex, tool, transparentIndex],
  );

  const handleStrokeSegment = useCallback(
    (fromIndex: number, toIndex: number) => {
      for (const index of lineIndices(
        fromIndex,
        toIndex,
        project.canvas.width,
      )) {
        handleStrokeMove(index);
      }
    },
    [handleStrokeMove, project.canvas.width],
  );

  const handleStrokeEnd = useCallback(() => {
    const stroke = strokeRef.current;
    if (!stroke) {
      return;
    }
    strokeRef.current = null;
    if (stroke.indices.length === 0) {
      return;
    }
    flushPendingPixels();
    setUndoState((state) => addPatch(state, stroke, UNDO_LIMIT));
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushPendingPixels]);

  const handleUndo = useCallback(() => {
    setUndoState((state) => {
      const patch = state.undo[state.undo.length - 1];
      if (!patch) {
        return state;
      }
      flushPendingPixels();
      setPixels((prev) => {
        const next = new Uint32Array(prev);
        applyPatch(next, patch, 'undo');
        pixelsRef.current = next;
        return next;
      });
      setFullRedrawToken((prev) => prev + 1);
      return {
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, patch],
      };
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushPendingPixels]);

  const handleRedo = useCallback(() => {
    setUndoState((state) => {
      const patch = state.redo[state.redo.length - 1];
      if (!patch) {
        return state;
      }
      flushPendingPixels();
      setPixels((prev) => {
        const next = new Uint32Array(prev);
        applyPatch(next, patch, 'redo');
        pixelsRef.current = next;
        return next;
      });
      setFullRedrawToken((prev) => prev + 1);
      return {
        undo: [...state.undo, patch],
        redo: state.redo.slice(0, -1),
      };
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushPendingPixels]);

  const explicitSaveAndExit = useCallback(async () => {
    await saveProjectExplicit(renderProject);
    setIsSessionNew(false);
    setIsDirty(false);
    onExit();
  }, [onExit, renderProject]);

  const discardAndExit = useCallback(async () => {
    if (isSessionNew) {
      await deleteProject(renderProject.id);
    }
    flushPendingPixels();
    await deleteWorkingCopy(renderProject.id);
    onExit();
  }, [flushPendingPixels, isSessionNew, onExit, renderProject.id]);

  const requestExit = useCallback(() => {
    if (!isDirty && !isSessionNew) {
      onExit();
      return;
    }
    if (promptOpenRef.current) {
      return;
    }
    promptOpenRef.current = true;
    Alert.alert('Unsaved changes', undefined, [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          promptOpenRef.current = false;
        },
      },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          promptOpenRef.current = false;
          void discardAndExit();
        },
      },
      {
        text: 'Save',
        onPress: () => {
          promptOpenRef.current = false;
          void explicitSaveAndExit();
        },
      },
    ]);
  }, [
    discardAndExit,
    explicitSaveAndExit,
    isDirty,
    isSessionNew,
    onExit,
  ]);

  const handleExportSvg = useCallback(async () => {
    const path = await exportSvgFile(renderProject);
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(path, {
        mimeType: 'image/svg+xml',
        dialogTitle: 'Share SVG',
      });
    }
  }, [renderProject]);

  const handleExportPng = useCallback(
    async (scale: PngScale) => {
      const path = await exportPng(renderProject, scale);
      await sharePng(path);
    },
    [renderProject],
  );

  const autosaveText = useMemo(() => {
    switch (autosave.status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Autosave idle';
    }
  }, [autosave.status]);

  const railBackground =
    theme.scheme === 'dark'
      ? 'rgba(12, 12, 12, 0.72)'
      : 'rgba(255, 255, 255, 0.78)';
  const railPositionStyle =
    RAIL_SIDE === 'left' ? styles.railLeft : styles.railRight;

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      requestExit();
      return true;
    });
    return () => handler.remove();
  }, [requestExit]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <View style={styles.canvasLayer}>
        <CanvasView
          project={renderProject}
          onStrokeStart={handleStrokeStart}
          onStrokeSegment={handleStrokeSegment}
          onStrokeEnd={handleStrokeEnd}
          theme={theme}
          dirtyIndices={dirtyBatch.indices}
          dirtyVersion={dirtyBatch.version}
          fullRedrawToken={fullRedrawToken}
        />
      </View>
      <View
        style={[
          styles.rail,
          railPositionStyle,
          { backgroundColor: railBackground },
          { top: topInset + 12 },
          isRailExpanded ? styles.railExpanded : styles.railCollapsed,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isRailExpanded ? 'Collapse menu' : 'Expand menu'
          }
          style={[
            styles.hamburger,
            { borderColor: theme.colors.border },
          ]}
          onPress={() => setIsRailExpanded((prev) => !prev)}
        >
          <View
            style={[
              styles.hamburgerBar,
              { backgroundColor: theme.colors.text },
            ]}
          />
          <View
            style={[
              styles.hamburgerBar,
              { backgroundColor: theme.colors.text },
            ]}
          />
          <View
            style={[
              styles.hamburgerBar,
              { backgroundColor: theme.colors.text },
            ]}
          />
        </Pressable>
        <ScrollView
          contentContainerStyle={styles.railContent}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={[
              styles.railButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={requestExit}
          >
            <Text
              style={[
                styles.railButtonText,
                { color: theme.colors.primaryText },
              ]}
            >
              {isRailExpanded ? 'Gallery' : 'Exit'}
            </Text>
          </Pressable>
          <View style={styles.railGroup}>
            {isRailExpanded ? (
              <Text
                style={[styles.railLabel, { color: theme.colors.textMuted }]}
              >
                Tools
              </Text>
            ) : null}
            <Pressable
              style={[
                styles.railButton,
                { backgroundColor: theme.colors.card },
                tool === 'pencil' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setTool('pencil')}
            >
              <Text
                style={[
                  styles.railButtonText,
                  { color: theme.colors.text },
                  tool === 'pencil' && { color: theme.colors.primaryText },
                ]}
              >
                {isRailExpanded ? 'Pencil' : 'P'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.railButton,
                { backgroundColor: theme.colors.card },
                tool === 'eraser' && { backgroundColor: theme.colors.primary },
              ]}
              onPress={() => setTool('eraser')}
            >
              <Text
                style={[
                  styles.railButtonText,
                  { color: theme.colors.text },
                  tool === 'eraser' && { color: theme.colors.primaryText },
                ]}
              >
                {isRailExpanded ? 'Eraser' : 'E'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.railGroup}>
            {isRailExpanded ? (
              <Text
                style={[styles.railLabel, { color: theme.colors.textMuted }]}
              >
                History
              </Text>
            ) : null}
            <Pressable
              style={[
                styles.railButton,
                { backgroundColor: theme.colors.primary },
                undoState.undo.length === 0 && styles.disabled,
              ]}
              onPress={handleUndo}
              disabled={undoState.undo.length === 0}
            >
              <Text
                style={[
                  styles.railButtonText,
                  { color: theme.colors.primaryText },
                ]}
              >
                {isRailExpanded ? 'Undo' : 'U'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.railButton,
                { backgroundColor: theme.colors.primary },
                undoState.redo.length === 0 && styles.disabled,
              ]}
              onPress={handleRedo}
              disabled={undoState.redo.length === 0}
            >
              <Text
                style={[
                  styles.railButtonText,
                  { color: theme.colors.primaryText },
                ]}
              >
                {isRailExpanded ? 'Redo' : 'R'}
              </Text>
            </Pressable>
          </View>
          {isRailExpanded ? (
            <>
              <View style={styles.railGroup}>
                <Text
                  style={[styles.railLabel, { color: theme.colors.textMuted }]}
                >
                  Palette
                </Text>
                <View style={styles.paletteRow}>
                  {project.palette.colors.map((color, index) => {
                    const selected = index === selectedIndex;
                    return (
                      <Pressable
                        key={`${color}_${index}`}
                        style={[
                          styles.paletteSwatch,
                          { backgroundColor: color },
                          { borderColor: theme.colors.border },
                          selected && { borderColor: theme.colors.primary },
                        ]}
                        onPress={() => setSelectedIndex(index)}
                      />
                    );
                  })}
                </View>
              </View>
              <View style={styles.railGroup}>
                <Text
                  style={[styles.railLabel, { color: theme.colors.textMuted }]}
                >
                  Export
                </Text>
                <Pressable
                  style={[
                    styles.railButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleExportSvg}
                >
                  <Text
                    style={[
                      styles.railButtonText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Export SVG
                  </Text>
                </Pressable>
                {[1, 2, 4, 8].map((scale) => (
                  <Pressable
                    key={`${scale}x`}
                    style={[
                      styles.railButton,
                      { backgroundColor: theme.colors.primary },
                    ]}
                    onPress={() => void handleExportPng(scale as PngScale)}
                  >
                    <Text
                      style={[
                        styles.railButtonText,
                        { color: theme.colors.primaryText },
                      ]}
                    >
                      PNG {scale}x
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.railGroup}>
                <Text
                  style={[styles.railLabel, { color: theme.colors.textMuted }]}
                >
                  Project
                </Text>
                <Text style={[styles.railText, { color: theme.colors.text }]}>
                  {project.name}
                </Text>
                <Text
                  style={[styles.railText, { color: theme.colors.textMuted }]}
                >
                  {project.canvas.width}x{project.canvas.height}
                </Text>
                <Text
                  style={[styles.railText, { color: theme.colors.textMuted }]}
                >
                  {autosaveText}
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  canvasLayer: {
    flex: 1,
  },
  rail: {
    position: 'absolute',
    bottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  railLeft: {
    left: 12,
  },
  railRight: {
    right: 12,
  },
  railCollapsed: {
    width: 68,
  },
  railExpanded: {
    width: 228,
  },
  railContent: {
    gap: 12,
    paddingBottom: 12,
  },
  hamburger: {
    alignSelf: 'center',
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 4,
  },
  hamburgerBar: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  railGroup: {
    gap: 8,
  },
  railLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  railButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  railButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  railText: {
    fontSize: 12,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paletteSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
