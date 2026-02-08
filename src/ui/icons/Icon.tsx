import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { getIconRenderer, type IconName } from './iconRegistry';

interface IconProps {
  name: IconName;
  size: number;
  color: string;
  fallbackLabel?: string;
  labelStyle?: StyleProp<TextStyle>;
}

export const Icon = React.memo(function Icon({
  name,
  size,
  color,
  fallbackLabel,
  labelStyle,
}: IconProps): React.ReactElement | null {
  const renderIcon = getIconRenderer(name);
  if (!renderIcon) {
    if (!fallbackLabel) {
      return null;
    }
    return <Text style={[styles.fallback, labelStyle]}>{fallbackLabel}</Text>;
  }
  return renderIcon({
    width: size,
    height: size,
    color,
    fill: color,
  });
});

const styles = StyleSheet.create({
  fallback: {
    fontSize: 12,
    fontWeight: '600',
  },
});
