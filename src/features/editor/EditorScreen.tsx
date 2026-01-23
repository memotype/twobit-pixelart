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
import { isTransparent } from '../../lib/project/palette';
import {
  deleteWorkingCopy,
  saveProjectExplicit,
  saveWorkingCopy,
} from '../../lib/storage/projectStorage';
import { exportSvgFile } from '../../lib/export/svgExport';
import { exportPng, sharePng, type PngScale } from '../../lib/export/pngExport';
import { CanvasView } from './CanvasView';
import { PalettePicker } from './PalettePicker';
import { ToolBar, type ToolType } from './ToolBar';
import { addPatch, applyPatch, createUndoState } from './undo';
import { useAutosave } from './useAutosave';
import type { Theme } from '../../ui/theme';

interface EditorScreenProps {
  project: ProjectRuntime;
  onExit: () => void;
  theme: Theme;
  topInset: number;
  isNewProject: boolean;
}

interface StrokeState {
  indices: number[];
  before: number[];
  after: number[];
  seen: Set<number>;
}

const AUTOSAVE_DELAY_MS = 1200;
const UNDO_LIMIT = 100;

export function EditorScreen({
  project,
  onExit,
  theme,
  topInset,
  isNewProject,
}: EditorScreenProps): React.ReactElement {
  const [tool, setTool] = useState<ToolType>('pencil');
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [undoState, setUndoState] = useState(createUndoState());
  const [isDirty, setIsDirty] = useState(false);
  const [isSessionNew] = useState(isNewProject);
  const [pixels, setPixels] = useState<Uint32Array>(
    () => new Uint32Array(project.pixels),
  );
  const strokeRef = useRef<StrokeState | null>(null);
  const pixelsRef = useRef<Uint32Array>(pixels);
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

  const applyPixel = useCallback(
    (index: number, value: number) => {
      setPixels((prev) => {
        const next = new Uint32Array(prev);
        next[index] = value;
        pixelsRef.current = next;
        return next;
      });
    },
    [],
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
        stroke.seen.add(index);
        stroke.indices.push(index);
        stroke.before.push(pixelsRef.current[index]);
        stroke.after.push(paintValue);
      }
      applyPixel(index, paintValue);
    },
    [applyPixel, selectedIndex, tool, transparentIndex],
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
      stroke.seen.add(index);
      stroke.indices.push(index);
      stroke.before.push(pixelsRef.current[index]);
      stroke.after.push(paintValue);
      applyPixel(index, paintValue);
    },
    [applyPixel, selectedIndex, tool, transparentIndex],
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
    setUndoState((state) => addPatch(state, stroke, UNDO_LIMIT));
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave]);

  const handleUndo = useCallback(() => {
    setUndoState((state) => {
      const patch = state.undo[state.undo.length - 1];
      if (!patch) {
        return state;
      }
      setPixels((prev) => {
        const next = new Uint32Array(prev);
        applyPatch(next, patch, 'undo');
        pixelsRef.current = next;
        return next;
      });
      return {
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, patch],
      };
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave]);

  const handleRedo = useCallback(() => {
    setUndoState((state) => {
      const patch = state.redo[state.redo.length - 1];
      if (!patch) {
        return state;
      }
      setPixels((prev) => {
        const next = new Uint32Array(prev);
        applyPatch(next, patch, 'redo');
        pixelsRef.current = next;
        return next;
      });
      return {
        undo: [...state.undo, patch],
        redo: state.redo.slice(0, -1),
      };
    });
    setIsDirty(true);
    autosave.markDirty();
  }, [autosave]);

  const explicitSaveAndExit = useCallback(async () => {
    await saveProjectExplicit(renderProject);
    setIsDirty(false);
    onExit();
  }, [onExit, renderProject]);

  const discardAndExit = useCallback(async () => {
    await deleteWorkingCopy(renderProject.id);
    onExit();
  }, [onExit, renderProject.id]);

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

  const handleExportPng = useCallback(async (scale: PngScale) => {
    const path = await exportPng(renderProject, scale);
    await sharePng(path);
  }, [renderProject]);

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
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
          paddingTop: topInset,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {project.name}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              {project.canvas.width}x{project.canvas.height}
            </Text>
          </View>
          <Pressable
            style={[
              styles.exitButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={requestExit}
          >
            <Text
              style={[
                styles.exitText,
                { color: theme.colors.primaryText },
              ]}
            >
              Gallery
            </Text>
          </Pressable>
        </View>
        <View
          style={[
            styles.canvasCard,
            { backgroundColor: theme.colors.card },
          ]}
        >
          <CanvasView
            project={renderProject}
            onStrokeStart={handleStrokeStart}
            onStrokeMove={handleStrokeMove}
            onStrokeEnd={handleStrokeEnd}
            theme={theme}
          />
          <Text style={[styles.statusText, { color: theme.colors.textMuted }]}>
            {autosaveText}
          </Text>
        </View>
        <ToolBar
          tool={tool}
          onSelect={setTool}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoState.undo.length > 0}
          canRedo={undoState.redo.length > 0}
          theme={theme}
        />
        <PalettePicker
          colors={project.palette.colors}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          theme={theme}
        />
        <View
          style={[
            styles.exportCard,
            { backgroundColor: theme.colors.card },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Export
          </Text>
          <Pressable
            style={[
              styles.exportButton,
              { backgroundColor: theme.colors.primary },
            ]}
            onPress={handleExportSvg}
          >
            <Text
              style={[
                styles.exportText,
                { color: theme.colors.primaryText },
              ]}
            >
              Export SVG
            </Text>
          </Pressable>
          <View style={styles.exportRow}>
            {[1, 2, 4, 8].map((scale) => (
              <Pressable
                key={`${scale}x`}
                style={[
                  styles.exportButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={() => void handleExportPng(scale as PngScale)}
              >
                <Text
                  style={[
                    styles.exportText,
                    { color: theme.colors.primaryText },
                  ]}
                >
                  PNG {scale}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(
              'Discard changes?',
              'This will leave without saving new changes.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: () => {
                    void discardAndExit();
                  },
                },
              ],
            );
          }}
        >
          <Text style={[styles.deleteText, { color: theme.colors.danger }]}>
            Exit without saving
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  exitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  canvasCard: {
    padding: 12,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusText: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exportCard: {
    padding: 12,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  exportButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  exportText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
