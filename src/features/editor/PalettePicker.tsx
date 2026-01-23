import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Theme } from '../../ui/theme';

interface PalettePickerProps {
  colors: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  theme: Theme;
}

export function PalettePicker({
  colors,
  selectedIndex,
  onSelect,
  theme,
}: PalettePickerProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        Palette
      </Text>
      <View style={styles.row}>
        {colors.map((color, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={`${color}_${index}`}
              style={[
                styles.swatch,
                { backgroundColor: color },
                selected && styles.selected,
                { borderColor: theme.colors.border },
                selected && { borderColor: theme.colors.primary },
              ]}
              onPress={() => onSelect(index)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  label: {
    fontSize: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
  },
  selected: {
    borderWidth: 2,
  },
});
