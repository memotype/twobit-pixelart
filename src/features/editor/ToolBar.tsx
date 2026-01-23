import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../../ui/theme';

export type ToolType = 'pencil' | 'eraser';

interface ToolBarProps {
  tool: ToolType;
  onSelect: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  theme: Theme;
}

export function ToolBar({
  tool,
  onSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  theme,
}: ToolBarProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <Pressable
          style={[
            styles.toolButton,
            { backgroundColor: theme.colors.card },
            tool === 'pencil' && styles.active,
            tool === 'pencil' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => onSelect('pencil')}
        >
          <Text
            style={[
              styles.toolText,
              { color: theme.colors.text },
              tool === 'pencil' && styles.toolTextDark,
              tool === 'pencil' && { color: theme.colors.primaryText },
            ]}
          >
            Pencil
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toolButton,
            { backgroundColor: theme.colors.card },
            tool === 'eraser' && styles.active,
            tool === 'eraser' && { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => onSelect('eraser')}
        >
          <Text
            style={[
              styles.toolText,
              { color: theme.colors.text },
              tool === 'eraser' && styles.toolTextDark,
              tool === 'eraser' && { color: theme.colors.primaryText },
            ]}
          >
            Eraser
          </Text>
        </Pressable>
      </View>
      <View style={styles.group}>
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.primary },
            !canUndo && styles.disabled,
          ]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Text
            style={[
              styles.toolTextDark,
              { color: theme.colors.primaryText },
            ]}
          >
            Undo
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.primary },
            !canRedo && styles.disabled,
          ]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Text
            style={[
              styles.toolTextDark,
              { color: theme.colors.primaryText },
            ]}
          >
            Redo
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    gap: 12,
  },
  group: {
    flexDirection: 'row',
    gap: 8,
  },
  toolButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toolText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toolTextDark: {
    fontSize: 12,
    fontWeight: '600',
  },
  active: {
  },
  disabled: {
    opacity: 0.5,
  },
});
