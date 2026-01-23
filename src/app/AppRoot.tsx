import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { ProjectRuntime } from '../lib/project/types';
import { GalleryScreen } from '../features/gallery/GalleryScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { getTheme } from '../ui/theme';

export function AppRoot(): React.ReactElement {
  const [activeProject, setActiveProject] = useState<ProjectRuntime | null>(
    null,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);

  const handleExit = () => {
    setActiveProject(null);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {activeProject ? (
        <EditorScreen
          project={activeProject}
          onExit={handleExit}
          theme={theme}
        />
      ) : (
        <GalleryScreen
          onOpen={setActiveProject}
          refreshKey={refreshKey}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
