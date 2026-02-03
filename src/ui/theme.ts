import type { ColorSchemeName } from 'react-native';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  neutral: string;
  neutralText: string;
  danger: string;
  canvas: string;
}

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
}

const lightColors: ThemeColors = {
  background: '#f6f5ef',
  card: '#ffffff',
  text: '#1f1f1f',
  textMuted: '#6b6b6b',
  border: '#e5e5e5',
  primary: '#111827',
  primaryText: '#ffffff',
  neutral: '#e6e3d6',
  neutralText: '#1f1f1f',
  danger: '#b45309',
  canvas: '#ffffff',
};

const darkColors: ThemeColors = {
  background: '#0b0b0b',
  card: '#1a1a1a',
  text: '#f5f5f5',
  textMuted: '#b4b4b4',
  border: '#2a2a2a',
  primary: '#f5f5f5',
  primaryText: '#0b0b0b',
  neutral: '#2b2b2b',
  neutralText: '#f5f5f5',
  danger: '#fb923c',
  canvas: '#0f0f0f',
};

export function getTheme(scheme: ColorSchemeName): Theme {
  if (scheme === 'dark') {
    return { scheme: 'dark', colors: darkColors };
  }
  return { scheme: 'light', colors: lightColors };
}
