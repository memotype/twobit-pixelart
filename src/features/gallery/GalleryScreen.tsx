import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
  onOpen: (project: ProjectRuntime, isNew: boolean) => void;
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

export function GalleryScreen({
  onOpen,
  refreshKey,
  theme,
  topInset,
}: GalleryScreenProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [width, setWidth] = useState('32');
  const [height, setHeight] = useState('32');

  const trimmedName = name.trim();
  const isCreateEnabled = trimmedName.length > 0;

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
        onOpen(project, false);
        return;
      }
      Alert.alert('Restore unsaved changes?', undefined, [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            await deleteWorkingCopy(id);
            const project = await loadProject(id);
            onOpen(project, false);
          },
        },
        {
          text: 'Restore',
          onPress: async () => {
            const project = await loadWorkingCopy(id);
            onOpen(project, false);
          },
        },
      ]);
    },
    [onOpen],
  );

  const handleCreate = useCallback(async () => {
    if (!isCreateEnabled) {
      return;
    }
    const nextWidth = clampInt(width, 32);
    const nextHeight = clampInt(height, 32);
    const project = createNewProject(
      trimmedName || 'Untitled',
      nextWidth,
      nextHeight,
    );
    await saveProject(project);
    onOpen(project, true);
  }, [height, isCreateEnabled, onOpen, trimmedName, width]);

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
          paddingTop: topInset,
        },
      ]}
    >
      <View style={styles.header}>
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
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          New Project
        </Text>
        <View style={styles.row}>
          <TextInput
            style={[
              styles.input,
              styles.nameInput,
              {
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
              },
            ]}
            placeholder="New Project Title"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>
              Width
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                },
              ]}
              keyboardType="number-pad"
              placeholderTextColor={theme.colors.textMuted}
              value={width}
              onChangeText={setWidth}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>
              Height
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                },
              ]}
              keyboardType="number-pad"
              placeholderTextColor={theme.colors.textMuted}
              value={height}
              onChangeText={setHeight}
            />
          </View>
        </View>
        <Pressable
          style={[
            styles.primaryButton,
            {
              backgroundColor: theme.colors.primary ?? theme.colors.text,
            },
            !isCreateEnabled && styles.primaryButtonDisabled,
          ]}
          disabled={!isCreateEnabled}
          onPress={handleCreate}
        >
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: theme.colors.primaryText ?? theme.colors.background,
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
                {item.updatedAt}
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
    padding: 24,
    paddingBottom: 12,
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
    marginTop: 12,
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#4f4f4f',
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  nameInput: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 16,
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
