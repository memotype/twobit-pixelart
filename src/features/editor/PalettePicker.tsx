import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface PalettePickerProps {
  colors: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function PalettePicker({
  colors,
  selectedIndex,
  onSelect,
}: PalettePickerProps): React.ReactElement {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Palette</Text>
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
    color: '#4f4f4f',
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
    borderColor: '#d4d4d4',
  },
  selected: {
    borderColor: '#111827',
    borderWidth: 2,
  },
});
