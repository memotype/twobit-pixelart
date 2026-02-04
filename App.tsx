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
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { ProjectRuntime } from './src/lib/project/types';
import { GalleryScreen } from './src/features/gallery/GalleryScreen';
import { EditorScreenV2 } from './src/features/editor/EditorScreenV2';
import { getTheme } from './src/ui/theme';

function AppShell(): React.ReactElement {
  const [activeProject, setActiveProject] = useState<ProjectRuntime | null>(
    null,
  );
  const [isNewProject, setIsNewProject] = useState(false);
  const [isRestoredWorkingCopy, setIsRestoredWorkingCopy] = useState(false);
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
    setIsRestoredWorkingCopy(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleOpen = (
    project: ProjectRuntime,
    isNew: boolean,
    restoredWorkingCopy: boolean,
  ) => {
    setActiveProject(project);
    setIsNewProject(isNew);
    setIsRestoredWorkingCopy(restoredWorkingCopy);
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
          key={`${activeProject.id}:${isRestoredWorkingCopy ? 'r' : 'c'}`}
          project={activeProject}
          onExit={handleExit}
          theme={theme}
          topInset={topInset}
          isNewProject={isNewProject}
          isRestoredWorkingCopy={isRestoredWorkingCopy}
        />
      ) : (
        <GalleryScreen
          onOpen={handleOpen}
          refreshKey={refreshKey}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}

export default function App(): React.ReactElement {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AppShell />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
