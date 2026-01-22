import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type ToolType = 'pencil' | 'eraser';

interface ToolBarProps {
  tool: ToolType;
  onSelect: (tool: ToolType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ToolBar({
  tool,
  onSelect,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolBarProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <View style={styles.group}>
        <Pressable
          style={[styles.toolButton, tool === 'pencil' && styles.active]}
          onPress={() => onSelect('pencil')}
        >
          <Text
            style={[styles.toolText, tool === 'pencil' && styles.toolTextDark]}
          >
            Pencil
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toolButton, tool === 'eraser' && styles.active]}
          onPress={() => onSelect('eraser')}
        >
          <Text
            style={[styles.toolText, tool === 'eraser' && styles.toolTextDark]}
          >
            Eraser
          </Text>
        </Pressable>
      </View>
      <View style={styles.group}>
        <Pressable
          style={[styles.actionButton, !canUndo && styles.disabled]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Text style={styles.toolTextDark}>Undo</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, !canRedo && styles.disabled]}
          onPress={onRedo}
          disabled={!canRedo}
        >
          <Text style={styles.toolTextDark}>Redo</Text>
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
    backgroundColor: '#f4f4f4',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#111827',
  },
  toolText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  toolTextDark: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  active: {
    backgroundColor: '#111827',
  },
  disabled: {
    opacity: 0.5,
  },
});
