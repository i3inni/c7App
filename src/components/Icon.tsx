import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function Icon({ name, size = 20, color = '#000', strokeWidth = 1.8 }: IconProps) {
  const s = size;
  const sw = strokeWidth;
  switch (name) {
    case 'activity':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M22 12H18L15 21L9 3L6 12H2" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'alert':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Line x1="12" y1="9" x2="12" y2="13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="12" cy="17" r="0.8" fill={color} />
        </Svg>
      );
    case 'alert-circle':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
          <Line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="12" cy="16" r="0.8" fill={color} />
        </Svg>
      );
    case 'bar-chart':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="12" width="4" height="9" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="10" y="7" width="4" height="14" rx="1" stroke={color} strokeWidth={sw} />
          <Rect x="17" y="3" width="4" height="18" rx="1" stroke={color} strokeWidth={sw} />
        </Svg>
      );
    case 'check-circle':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Path d="M22 4L12 14.01l-3-3" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'clipboard':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M9 5a2 2 0 002 2h2a2 2 0 002-2 2 2 0 00-2-2h-2a2 2 0 00-2 2z" stroke={color} strokeWidth={sw} />
          <Line x1="9" y1="12" x2="15" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="9" y1="16" x2="13" y2="16" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Path d="M12 7V12L15 14" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'info':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
          <Line x1="12" y1="16" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx="12" cy="8" r="0.8" fill={color} />
        </Svg>
      );
    case 'plus-circle':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={sw} />
          <Line x1="12" y1="8" x2="12" y2="16" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <Line x1="8" y1="12" x2="16" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </Svg>
      );
    case 'refresh-cw':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M23 4v6h-6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'shield':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </Svg>
      );
    case 'target':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="4" stroke={color} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="1.2" fill={color} />
        </Svg>
      );
    case 'trending-down':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M22 17L13.5 8.5 8.5 13.5 2 7" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16 17h6v-6" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'trending-up':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M22 7L13.5 15.5L8.5 10.5L2 17" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M16 7H22V13" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'zap':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
          <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    default:
      return null;
  }
}

export const ANALYSIS_ICON_MAP: Record<string, string> = {
  '📊': 'bar-chart',
  '🕐': 'clock',
  '🔄': 'refresh-cw',
  '⚠️': 'alert',
};
