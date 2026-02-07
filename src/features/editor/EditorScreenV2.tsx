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
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { CanvasView, type CanvasViewHandle } from './CanvasView';
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
const STROKE_TRACE_ENABLED = true;

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
  const undoStateRef = useRef(undoState);
  const [isDirty, setIsDirty] = useState(isRestoredWorkingCopy);
  const [isSessionNew, setIsSessionNew] = useState(isNewProject);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pixelBuffer] = useState<Uint32Array>(
    () => new Uint32Array(project.pixels),
  );
  const [menuScroll, setMenuScroll] = useState({
    x: 0,
    viewWidth: 0,
    contentWidth: 0,
  });
  const [showChevronHint, setShowChevronHint] = useState(false);
  const canvasRef = useRef<CanvasViewHandle | null>(null);
  const strokeRef = useRef<StrokeState | null>(null);
  const pixelsRef = useRef<Uint32Array>(pixelBuffer);
  const dirtyIndicesRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const promptOpenRef = useRef(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const strokeIdRef = useRef(0);
  const traceRef = useRef({
    id: 0,
    startSeq: -1,
    startIndex: -1,
    segmentCount: 0,
    moveCount: 0,
    appliedCount: 0,
    firstAppliedSeq: -1,
  });

  const transparentIndex = useMemo(() => {
    const index = project.palette.colors.findIndex((color) =>
      isTransparent(color),
    );
    return index === -1 ? 0 : index;
  }, [project.palette.colors]);

  const buildProjectSnapshot = useCallback((): ProjectRuntime => {
    return {
      ...project,
      pixels: new Uint32Array(pixelsRef.current),
    };
  }, [project]);

  const autosave = useAutosave(async () => {
    await saveWorkingCopy(buildProjectSnapshot());
  }, AUTOSAVE_DELAY_MS);

  const flushDirtyPixels = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const indices = Array.from(dirtyIndicesRef.current);
    dirtyIndicesRef.current.clear();
    if (indices.length < 1) {
      return;
    }
    canvasRef.current?.applyDirtyPixels(indices);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushDirtyPixels();
    });
  }, [flushDirtyPixels]);

  const applyPixel = useCallback(
    (index: number, value: number) => {
      if (pixelsRef.current[index] === value) {
        return;
      }
      pixelsRef.current[index] = value;
      dirtyIndicesRef.current.add(index);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const traceStroke = useCallback((message: string) => {
    if (!STROKE_TRACE_ENABLED) {
      return;
    }
    console.log(`[stroke-trace] ${message}`);
  }, []);

  const ensureStroke = useCallback((): StrokeState => {
    if (!strokeRef.current) {
      strokeRef.current = {
        indices: [],
        before: [],
        after: [],
        seen: new Set(),
      };
    }
    return strokeRef.current;
  }, []);

  const handleStrokeStart = useCallback(
    (index: number, seq: number) => {
      if (!strokeRef.current) {
        strokeIdRef.current += 1;
        traceRef.current = {
          id: strokeIdRef.current,
          startSeq: seq,
          startIndex: index,
          segmentCount: 0,
          moveCount: 0,
          appliedCount: 0,
          firstAppliedSeq: -1,
        };
        traceStroke(
          `start id=${strokeIdRef.current} seq=${seq} index=${index}`,
        );
      }
      const stroke = ensureStroke();
      const paintValue = tool === 'eraser' ? transparentIndex : selectedIndex;
      if (!stroke.seen.has(index)) {
        const currentValue = pixelsRef.current[index];
        stroke.seen.add(index);
        if (currentValue !== paintValue) {
          stroke.indices.push(index);
          stroke.before.push(currentValue);
          stroke.after.push(paintValue);
          applyPixel(index, paintValue);
          traceRef.current.appliedCount += 1;
          if (traceRef.current.firstAppliedSeq < 0) {
            traceRef.current.firstAppliedSeq = seq;
          }
        }
      }
    },
    [
      applyPixel,
      ensureStroke,
      selectedIndex,
      tool,
      traceStroke,
      transparentIndex,
    ],
  );

  const handleStrokeMove = useCallback(
    (index: number, seq: number) => {
      const stroke = ensureStroke();
      traceRef.current.moveCount += 1;
      const paintValue = tool === 'eraser' ? transparentIndex : selectedIndex;
      if (stroke.seen.has(index)) {
        return;
      }
      const currentValue = pixelsRef.current[index];
      stroke.seen.add(index);
      if (currentValue !== paintValue) {
        stroke.indices.push(index);
        stroke.before.push(currentValue);
        stroke.after.push(paintValue);
        applyPixel(index, paintValue);
        traceRef.current.appliedCount += 1;
        if (traceRef.current.firstAppliedSeq < 0) {
          traceRef.current.firstAppliedSeq = seq;
        }
      }
    },
    [applyPixel, ensureStroke, selectedIndex, tool, transparentIndex],
  );

  const handleStrokeSegment = useCallback(
    (fromIndex: number, toIndex: number, seq: number) => {
      traceRef.current.segmentCount += 1;
      if (traceRef.current.segmentCount <= 6) {
        traceStroke(
          `segment id=${traceRef.current.id} seq=${seq}` +
            ` from=${fromIndex} to=${toIndex}`,
        );
      }
      for (const index of lineIndices(
        fromIndex,
        toIndex,
        project.canvas.width,
      )) {
        handleStrokeMove(index, seq);
      }
    },
    [handleStrokeMove, project.canvas.width, traceStroke],
  );

  const handleStrokeEnd = useCallback((seq: number) => {
    const stroke = strokeRef.current;
    if (!stroke) {
      traceStroke(`end seq=${seq} with no stroke state`);
      return;
    }
    strokeRef.current = null;
    traceStroke(
      `end id=${traceRef.current.id} seq=${seq} ` +
        `startSeq=${traceRef.current.startSeq} ` +
        `segments=${traceRef.current.segmentCount} ` +
        `moves=${traceRef.current.moveCount} ` +
        `applied=${traceRef.current.appliedCount} ` +
        `firstAppliedSeq=${traceRef.current.firstAppliedSeq}`,
    );
    if (stroke.indices.length === 0) {
      return;
    }
    flushDirtyPixels();
    setUndoState((state) => addPatch(state, stroke, UNDO_LIMIT));
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushDirtyPixels, traceStroke]);

  const handleUndo = useCallback(() => {
    const state = undoStateRef.current;
    const patch = state.undo[state.undo.length - 1];
    if (!patch) {
      return;
    }
    flushDirtyPixels();
    applyPatch(pixelsRef.current, patch, 'undo');
    canvasRef.current?.requestFullRedraw();
    setUndoState({
      undo: state.undo.slice(0, -1),
      redo: [...state.redo, patch],
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushDirtyPixels]);

  const handleRedo = useCallback(() => {
    const state = undoStateRef.current;
    const patch = state.redo[state.redo.length - 1];
    if (!patch) {
      return;
    }
    flushDirtyPixels();
    applyPatch(pixelsRef.current, patch, 'redo');
    canvasRef.current?.requestFullRedraw();
    setUndoState({
      undo: [...state.undo, patch],
      redo: state.redo.slice(0, -1),
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave, flushDirtyPixels]);

  const explicitSaveAndExit = useCallback(async () => {
    await saveProjectExplicit(buildProjectSnapshot());
    setIsSessionNew(false);
    setIsDirty(false);
    onExit();
  }, [buildProjectSnapshot, onExit]);

  const discardAndExit = useCallback(async () => {
    if (isSessionNew) {
      await deleteProject(project.id);
    }
    flushDirtyPixels();
    await deleteWorkingCopy(project.id);
    onExit();
  }, [flushDirtyPixels, isSessionNew, onExit, project.id]);

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
    const path = await exportSvgFile(buildProjectSnapshot());
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(path, {
        mimeType: 'image/svg+xml',
        dialogTitle: 'Share SVG',
      });
    }
  }, [buildProjectSnapshot]);

  const handleExportPng = useCallback(
    async (scale: PngScale) => {
      const path = await exportPng(buildProjectSnapshot(), scale);
      await sharePng(path);
    },
    [buildProjectSnapshot],
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

  const canScrollLeft = useMemo(
    () => menuScroll.x > 2,
    [menuScroll.x],
  );
  const canScrollRight = useMemo(() => {
    const maxScroll = Math.max(
      0,
      menuScroll.contentWidth - menuScroll.viewWidth,
    );
    return menuScroll.x < maxScroll - 2;
  }, [
    menuScroll.contentWidth,
    menuScroll.viewWidth,
    menuScroll.x,
  ]);

  const menuBackground =
    theme.scheme === 'dark'
      ? 'rgba(12, 12, 12, 0.72)'
      : 'rgba(255, 255, 255, 0.78)';

  const handleMenuLayout = useCallback((event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setMenuScroll((prev) => ({
      ...prev,
      viewWidth: width,
    }));
  }, []);

  const handleMenuContentSizeChange = useCallback((width: number) => {
    setMenuScroll((prev) => ({
      ...prev,
      contentWidth: width,
    }));
  }, []);

  const handleMenuScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      setMenuScroll((prev) => (prev.x === x ? prev : { ...prev, x }));
      if (x > 2) {
        setShowChevronHint(false);
      }
    },
    [],
  );

  const clearChevronTimer = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setShowChevronHint(true);
        clearChevronTimer();
        hintTimerRef.current = setTimeout(() => {
          setShowChevronHint(false);
          hintTimerRef.current = null;
        }, 2800);
      } else {
        clearChevronTimer();
        setShowChevronHint(false);
      }
      return next;
    });
  }, [clearChevronTimer]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    undoStateRef.current = undoState;
  }, [undoState]);

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
          ref={canvasRef}
          project={project}
          pixels={pixelBuffer}
          onStrokeStart={handleStrokeStart}
          onStrokeSegment={handleStrokeSegment}
          onStrokeEnd={handleStrokeEnd}
          theme={theme}
        />
      </View>
      <View
        pointerEvents="box-none"
        style={[styles.menuRow, { top: topInset * 0.12 }]}
      >
        {isMenuOpen ? (
          <View
            pointerEvents="auto"
            style={[
              styles.menuPanel,
              { backgroundColor: menuBackground },
              { borderColor: theme.colors.border },
            ]}
          >
            <ScrollView
              horizontal
              contentContainerStyle={styles.menuContent}
              onLayout={handleMenuLayout}
              onContentSizeChange={handleMenuContentSizeChange}
              onScroll={handleMenuScroll}
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
            >
              <View style={styles.menuGroup}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Project
                </Text>
                <Pressable
                  style={[
                    styles.menuButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={requestExit}
                >
                  <Text
                    style={[
                      styles.menuButtonText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Gallery
                  </Text>
                </Pressable>
                <Text
                  style={[styles.menuText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                <Text
                  style={[styles.menuText, { color: theme.colors.textMuted }]}
                >
                  {project.canvas.width}x{project.canvas.height}
                </Text>
              </View>
              <View style={styles.menuGroup}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Tools
                </Text>
                <View style={styles.menuRowItems}>
                  <Pressable
                    style={[
                      styles.menuButton,
                      { backgroundColor: theme.colors.card },
                      tool === 'pencil' && {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setTool('pencil')}
                  >
                    <Text
                      style={[
                        styles.menuButtonText,
                        { color: theme.colors.text },
                        tool === 'pencil' && {
                          color: theme.colors.primaryText,
                        },
                      ]}
                    >
                      Pencil
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.menuButton,
                      { backgroundColor: theme.colors.card },
                      tool === 'eraser' && {
                        backgroundColor: theme.colors.primary,
                      },
                    ]}
                    onPress={() => setTool('eraser')}
                  >
                    <Text
                      style={[
                        styles.menuButtonText,
                        { color: theme.colors.text },
                        tool === 'eraser' && {
                          color: theme.colors.primaryText,
                        },
                      ]}
                    >
                      Eraser
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.menuGroup}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  History
                </Text>
                <View style={styles.menuRowItems}>
                  <Pressable
                    style={[
                      styles.menuButton,
                      { backgroundColor: theme.colors.primary },
                      undoState.undo.length === 0 && styles.disabled,
                    ]}
                    onPress={handleUndo}
                    disabled={undoState.undo.length === 0}
                  >
                    <Text
                      style={[
                        styles.menuButtonText,
                        { color: theme.colors.primaryText },
                      ]}
                    >
                      Undo
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.menuButton,
                      { backgroundColor: theme.colors.primary },
                      undoState.redo.length === 0 && styles.disabled,
                    ]}
                    onPress={handleRedo}
                    disabled={undoState.redo.length === 0}
                  >
                    <Text
                      style={[
                        styles.menuButtonText,
                        { color: theme.colors.primaryText },
                      ]}
                    >
                      Redo
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.menuGroup}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Palette
                </Text>
                <View style={styles.menuPaletteRow}>
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
              <View style={styles.menuGroup}>
                <Text
                  style={[
                    styles.menuLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Export
                </Text>
                <Pressable
                  style={[
                    styles.menuButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                  onPress={handleExportSvg}
                >
                  <Text
                    style={[
                      styles.menuButtonText,
                      { color: theme.colors.primaryText },
                    ]}
                  >
                    Export SVG
                  </Text>
                </Pressable>
                <View style={styles.menuRowItems}>
                  {[1, 2, 4, 8].map((scale) => (
                    <Pressable
                      key={`${scale}x`}
                      style={[
                        styles.menuButton,
                        { backgroundColor: theme.colors.primary },
                      ]}
                      onPress={() => void handleExportPng(scale as PngScale)}
                    >
                      <Text
                        style={[
                          styles.menuButtonText,
                          { color: theme.colors.primaryText },
                        ]}
                      >
                        PNG {scale}x
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text
                  style={[styles.menuText, { color: theme.colors.textMuted }]}
                >
                  {autosaveText}
                </Text>
              </View>
            </ScrollView>
            {canScrollLeft ? (
              <View
                pointerEvents="none"
                style={[styles.menuFade, styles.menuFadeLeft]}
              >
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.5 },
                  ]}
                />
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.3 },
                  ]}
                />
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.15 },
                  ]}
                />
              </View>
            ) : null}
            {canScrollRight ? (
              <View
                pointerEvents="none"
                style={[styles.menuFade, styles.menuFadeRight]}
              >
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.5 },
                  ]}
                />
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.3 },
                  ]}
                />
                <View
                  style={[
                    styles.menuFadeBar,
                    { backgroundColor: menuBackground, opacity: 0.15 },
                  ]}
                />
              </View>
            ) : null}
            {showChevronHint && canScrollRight ? (
              <Text
                pointerEvents="none"
                style={[
                  styles.menuChevronHint,
                  { color: theme.colors.text },
                ]}
              >
                &gt;
              </Text>
            ) : null}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isMenuOpen ? 'Close menu' : 'Open menu'}
          style={[
            styles.hamburger,
            { borderColor: theme.colors.border },
            { backgroundColor: menuBackground },
          ]}
          onPress={handleToggleMenu}
        >
          <View
            style={[
              styles.hamburgerIcon,
              isMenuOpen && styles.hamburgerIconOpen,
            ]}
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
          </View>
        </Pressable>
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
  menuRow: {
    position: 'absolute',
    right: 12,
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  menuPanel: {
    position: 'absolute',
    right: 54,
    top: 0,
    maxWidth: 620,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  hamburger: {
    zIndex: 2,
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    gap: 4,
    transform: [{ rotate: '0deg' }],
  },
  hamburgerIconOpen: {
    transform: [{ rotate: '90deg' }],
  },
  hamburgerBar: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  menuContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  menuFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 30,
    flexDirection: 'row',
  },
  menuFadeLeft: {
    left: 0,
  },
  menuFadeRight: {
    right: 0,
    flexDirection: 'row-reverse',
  },
  menuFadeBar: {
    width: 10,
  },
  menuChevronHint: {
    position: 'absolute',
    right: 10,
    top: '50%',
    fontSize: 24,
    fontWeight: '600',
    transform: [{ translateY: -12 }],
    opacity: 0.7,
  },
  menuGroup: {
    minWidth: 120,
    gap: 8,
  },
  menuRowItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  menuButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuText: {
    fontSize: 12,
  },
  menuPaletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: 180,
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
