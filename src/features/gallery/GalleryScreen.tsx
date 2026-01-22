import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { ProjectRuntime, ProjectSummary } from '../../lib/project/types';
import { createNewProject } from '../../lib/project/createProject';
import {
  deleteProject,
  listProjects,
  loadProject,
  saveProject,
} from '../../lib/storage/projectStorage';

interface GalleryScreenProps {
  onOpen: (project: ProjectRuntime) => void;
  refreshKey: number;
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
}: GalleryScreenProps): React.ReactElement {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('New Project');
  const [width, setWidth] = useState('32');
  const [height, setHeight] = useState('32');

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

  const handleCreate = useCallback(async () => {
    const nextWidth = clampInt(width, 32);
    const nextHeight = clampInt(height, 32);
    const project = createNewProject(name.trim() || 'Untitled', nextWidth,
      nextHeight);
    await saveProject(project);
    onOpen(project);
  }, [height, name, onOpen, width]);

  const handleOpen = useCallback(
    async (id: string) => {
      const project = await loadProject(id);
      onOpen(project);
    },
    [onOpen],
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Pixel Forge</Text>
        <Text style={styles.subtitle}>Offline pixel art editor</Text>
      </View>
      <View style={styles.newProjectCard}>
        <Text style={styles.sectionTitle}>New Project</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.label}>Width</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={width}
              onChangeText={setWidth}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Height</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={height}
              onChangeText={setHeight}
            />
          </View>
        </View>
        <Pressable style={styles.primaryButton} onPress={handleCreate}>
          <Text style={styles.primaryButtonText}>Create</Text>
        </Pressable>
      </View>
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Projects</Text>
        <Text style={styles.listMeta}>
          {loading ? 'Loading...' : `${projects.length} items`}
        </Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.projectCard}>
            <Pressable
              style={styles.projectInfo}
              onPress={() => void handleOpen(item.id)}
            >
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.projectMeta}>
                {item.width}x{item.height}
              </Text>
              <Text style={styles.projectMeta}>{item.updatedAt}</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => void handleDelete(item.id, item.name)}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f5ef',
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f1f1f',
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  listHeader: {
    marginTop: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  listMeta: {
    fontSize: 12,
    color: '#6b6b6b',
  },
  list: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#ffffff',
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
    color: '#1f1f1f',
  },
  projectMeta: {
    fontSize: 12,
    color: '#6b6b6b',
    marginTop: 2,
  },
  deleteText: {
    color: '#c2410c',
    fontSize: 12,
    fontWeight: '600',
  },
});
