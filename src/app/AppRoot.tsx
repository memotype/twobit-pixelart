import React, { useMemo, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { ProjectRuntime } from '../lib/project/types';
import { GalleryScreen } from '../features/gallery/GalleryScreen';
import { EditorScreen } from '../features/editor/EditorScreen';
import { getTheme } from '../ui/theme';

export function AppRoot(): React.ReactElement {
  const [activeProject, setActiveProject] = useState<ProjectRuntime | null>(
    null,
  );
  const [isNewProject, setIsNewProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const topInset = useMemo(() => {
    if (Platform.OS === 'android') {
      return RNStatusBar.currentHeight ?? 0;
    }
    return 0;
  }, []);

  const handleExit = () => {
    setActiveProject(null);
    setIsNewProject(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpen = (project: ProjectRuntime, isNew: boolean) => {
    setActiveProject(project);
    setIsNewProject(isNew);
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: theme.colors.background },
      ]}
    >
      <StatusBar
        style={theme.scheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      {activeProject ? (
        <EditorScreen
          project={activeProject}
          onExit={handleExit}
          theme={theme}
          topInset={topInset}
          isNewProject={isNewProject}
        />
      ) : (
        <GalleryScreen
          onOpen={handleOpen}
          refreshKey={refreshKey}
          theme={theme}
          topInset={topInset}
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
