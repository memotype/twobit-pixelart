import React, { useMemo, useState } from 'react';
import {
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import type { ProjectRuntime } from '../lib/project/types';
import { GalleryScreen } from '../features/gallery/GalleryScreen';
import { EditorScreenV2 } from '../features/editor/EditorScreenV2';
import { getTheme } from '../ui/theme';

function AppShell(): React.ReactElement {
  const [activeProject, setActiveProject] = useState<ProjectRuntime | null>(
    null,
  );
  const [isNewProject, setIsNewProject] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);
  const insets = useSafeAreaInsets();
  const topInset = useMemo(() => {
    if (Platform.OS === 'android') {
      return RNStatusBar.currentHeight ?? 0;
    }
    return insets.top;
  }, [insets.top]);

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
      edges={['top', 'bottom']}
    >
      <StatusBar
        style={theme.scheme === 'dark' ? 'light' : 'dark'}
        backgroundColor={theme.colors.background}
        translucent={false}
      />
      {activeProject ? (
        <EditorScreenV2
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

export function AppRoot(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
