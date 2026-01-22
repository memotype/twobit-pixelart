import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import type { ProjectRuntime } from '../lib/project/types';
import { GalleryScreen } from '../features/gallery/GalleryScreen';
import { EditorScreen } from '../features/editor/EditorScreen';

export function AppRoot(): React.ReactElement {
  const [activeProject, setActiveProject] = useState<ProjectRuntime | null>(
    null,
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const handleExit = () => {
    setActiveProject(null);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {activeProject ? (
        <EditorScreen project={activeProject} onExit={handleExit} />
      ) : (
        <GalleryScreen onOpen={setActiveProject} refreshKey={refreshKey} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f5ef',
  },
});
