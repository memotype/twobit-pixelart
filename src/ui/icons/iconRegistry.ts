import type { ReactElement } from 'react';
import type { SvgProps } from 'react-native-svg';

export type IconName =
  | 'gallery'
  | 'pencil'
  | 'eraser'
  | 'undo'
  | 'redo'
  | 'export';

// Add imports here as SVG icons become available.
// Example:
// import UndoIcon from './svg/undo.svg';

type IconRenderer = (props: SvgProps) => ReactElement;

const ICONS: Partial<Record<IconName, IconRenderer>> = {};

export function getIconRenderer(name: IconName): IconRenderer | null {
  return ICONS[name] ?? null;
}
