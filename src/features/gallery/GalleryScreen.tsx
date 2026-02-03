import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import type { ProjectRuntime, ProjectSummary } from '../../lib/project/types';
import type { Theme } from '../../ui/theme';
import { createNewProject } from '../../lib/project/createProject';
import {
  deleteProject,
  listProjects,
  loadProject,
  loadWorkingCopy,
  cleanupTmpFiles,
  saveProject,
  workingCopyExists,
  deleteWorkingCopy,
} from '../../lib/storage/projectStorage';

interface GalleryScreenProps {
  onOpen: (
    project: ProjectRuntime,
    isNew: boolean,
    isRestoredWorkingCopy: boolean,
  ) => void;
  refreshKey: number;
  theme: Theme;
  topInset: number;
}

function clampInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(128, parsed));
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function GalleryScreen({
  onOpen,
  refreshKey,
  theme,
  topInset,
}: GalleryScreenProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [widthFocused, setWidthFocused] = useState(false);
  const [heightFocused, setHeightFocused] = useState(false);
  const window = useWindowDimensions();
  const nameFlash = React.useRef(new Animated.Value(0)).current;
  const widthFlash = React.useRef(new Animated.Value(0)).current;
  const heightFlash = React.useRef(new Animated.Value(0)).current;

  const trimmedName = name.trim();
  const trimmedWidth = width.trim();
  const trimmedHeight = height.trim();
  const isNameValid = trimmedName.length > 0;
  const isWidthValid = trimmedWidth.length > 0;
  const isHeightValid = trimmedHeight.length > 0;
  const isCreateEnabled = isNameValid && isWidthValid && isHeightValid;
  const headerTopPadding = window.height * 0.005;
  const errorBorderColor =
    theme.scheme === 'dark' ? '#800020' : '#dc143c';
  const nameBorderColor = useMemo(
    () =>
      isNameValid
        ? theme.colors.border
        : nameFlash.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.border, errorBorderColor],
          }),
    [errorBorderColor, isNameValid, nameFlash, theme.colors.border],
  );
  const widthBorderColor = useMemo(
    () =>
      isWidthValid
        ? theme.colors.border
        : widthFlash.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.border, errorBorderColor],
          }),
    [errorBorderColor, isWidthValid, theme.colors.border, widthFlash],
  );
  const heightBorderColor = useMemo(
    () =>
      isHeightValid
        ? theme.colors.border
        : heightFlash.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.border, errorBorderColor],
          }),
    [errorBorderColor, heightFlash, isHeightValid, theme.colors.border],
  );

  const flashInputBorders = useCallback(() => {
    const flashes = [
      { value: nameFlash, enabled: !isNameValid },
      { value: widthFlash, enabled: !isWidthValid },
      { value: heightFlash, enabled: !isHeightValid },
    ];
    flashes.forEach(({ value, enabled }) => {
      if (!enabled) {
        return;
      }
      value.stopAnimation();
      value.setValue(0);
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 140,
          useNativeDriver: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 320,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [
    heightFlash,
    isHeightValid,
    isNameValid,
    isWidthValid,
    nameFlash,
    widthFlash,
  ]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listProjects();
      setProjects(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const openProjectWithRecoveryPrompt = useCallback(
    async (id: string) => {
      await cleanupTmpFiles();
      const hasWorkingCopy = await workingCopyExists(id);
      if (!hasWorkingCopy) {
        const project = await loadProject(id);
        onOpen(project, false, false);
        return;
      }
      Alert.alert('Restore unsaved changes?', undefined, [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkingCopy(id);
            const project = await loadProject(id);
            onOpen(project, false, false);
          },
        },
        {
          text: 'Restore',
          onPress: async () => {
            const project = await loadWorkingCopy(id);
            onOpen(project, false, true);
          },
        },
      ]);
    },
    [onOpen],
  );

  const handleCreate = useCallback(async () => {
    if (!isCreateEnabled) {
      flashInputBorders();
      return;
    }
    const nextWidth = clampInt(trimmedWidth, 32);
    const nextHeight = clampInt(trimmedHeight, 32);
    const project = createNewProject(
      trimmedName || 'Untitled',
      nextWidth,
      nextHeight,
    );
    await saveProject(project);
    onOpen(project, true, false);
  }, [
    flashInputBorders,
    isCreateEnabled,
    onOpen,
    trimmedHeight,
    trimmedName,
    trimmedWidth,
  ]);

  const handleOpen = useCallback(
    async (id: string) => {
      await openProjectWithRecoveryPrompt(id);
    },
    [openProjectWithRecoveryPrompt],
  );

  const handleDelete = useCallback(async (id: string, title: string) => {
    Alert.alert('Delete project?', title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProject(id);
          await refresh();
        },
      },
    ]);
  }, [refresh]);

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={[styles.header, { paddingTop: headerTopPadding }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Pixel Forge
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
          Offline pixel art editor
        </Text>
      </View>
      <View
        style={[
          styles.newProjectCard,
          { backgroundColor: theme.colors.card },
        ]}
      >
        <View style={styles.row}>
          <AnimatedTextInput
            style={[
              styles.input,
              styles.nameInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                borderColor: nameBorderColor,
              },
            ]}
            placeholder={nameFocused ? '' : 'New Project Title'}
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>
        <View style={[styles.row, styles.rowSpacing]}>
          <View style={styles.field}>
            <AnimatedTextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: widthBorderColor,
                },
              ]}
              keyboardType="number-pad"
              placeholder={widthFocused ? '' : 'Width'}
              placeholderTextColor={theme.colors.textMuted}
              value={width}
              onChangeText={setWidth}
              onFocus={() => setWidthFocused(true)}
              onBlur={() => setWidthFocused(false)}
            />
          </View>
          <View style={styles.field}>
            <AnimatedTextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  borderColor: heightBorderColor,
                },
              ]}
              keyboardType="number-pad"
              placeholder={heightFocused ? '' : 'Height'}
              placeholderTextColor={theme.colors.textMuted}
              value={height}
              onChangeText={setHeight}
              onFocus={() => setHeightFocused(true)}
              onBlur={() => setHeightFocused(false)}
            />
          </View>
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            styles.rowSpacing,
            {
              backgroundColor: theme.colors.neutral,
            },
            !isCreateEnabled && styles.primaryButtonDisabled,
          ]}
          onPress={handleCreate}
        >
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: theme.colors.neutralText,
              },
              !isCreateEnabled && styles.primaryButtonTextDisabled,
            ]}
          >
            Create
          </Text>
        </Pressable>
      </View>
      <View style={styles.listHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Projects
        </Text>
        <Text style={[styles.listMeta, { color: theme.colors.textMuted }]}>
          {loading ? 'Loading...' : `${projects.length} projects`}
        </Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={[styles.projectCard, { backgroundColor: theme.colors.card }]}
          >
            <Pressable
              style={styles.projectInfo}
              onPress={() => void handleOpen(item.id)}
            >
              <Text style={[styles.projectName, { color: theme.colors.text }]}>
                {item.name}
              </Text>
              <Text
                style={[styles.projectMeta, { color: theme.colors.textMuted }]}
              >
                {item.width}x{item.height}
              </Text>
              <Text
                style={[styles.projectMeta, { color: theme.colors.textMuted }]}
              >
                {formatTimestamp(item.updatedAt)}
              </Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => void handleDelete(item.id, item.name)}
            >
              <Text style={[styles.deleteText, { color: theme.colors.danger }]}>
                Delete
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1f1f1f',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#4f4f4f',
  },
  newProjectCard: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowSpacing: {
    marginTop: 12,
  },
  field: {
    flex: 1,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  nameInput: {
    flex: 1,
  },
  primaryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryButtonTextDisabled: {
    opacity: 0.8,
  },
  listHeader: {
    marginTop: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  listMeta: {
    fontSize: 16,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  projectCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectInfo: {
    flex: 1,
    paddingRight: 12,
  },
  deleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
  },
  projectMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
