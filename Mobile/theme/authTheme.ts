export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getAuthMetrics = (width: number, height: number, fontScale = 1) => {
  const compactWidth = width < 360;
  const compactHeight = height < 700;
  const tablet = width >= 768;
  const largeText = fontScale >= 1.5;
  const horizontalPadding = clamp(width * 0.05, compactWidth ? 12 : 16, tablet ? 32 : 24);

  return {
    compactWidth,
    compactHeight,
    tablet,
    largeText,
    horizontalPadding,
    contentMaxWidth: tablet ? 560 : 460,
    sectionGap: compactHeight ? 14 : 20,
    controlMinHeight: largeText ? 58 : 54,
  };
};

export const AUTH_COLORS = {
  background: '#FFFFFF',
  backgroundDeep: '#0F2954',
  backgroundElevated: '#FFFFFF',
  cardDark: '#FFFFFF',
  cardDarkAlt: '#F8FAFC',
  cardBorder: '#E5E7EB',
  cardBorderActive: '#1C4D8D',
  cardLight: '#FFFFFF',
  cardLightBorder: '#E5E7EB',
  tile: '#F8FAFC',
  tileSoft: 'rgba(255,255,255,0.12)',
  primary: '#1C4D8D',
  primaryText: '#FFFFFF',
  onBlue: '#1C4D8D',
  onBlueMuted: '#475569',
  onBlueSoft: '#64748B',
  blueControlSurface: '#EAF1FB',
  blueControlSurfacePressed: '#DCE6F7',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#6B7280',
  textTertiary: '#9CA3AF',
  inputDark: '#F9FAFB',
  inputDarkBorder: '#E5E7EB',
  inputLight: '#F9FAFB',
  inputLightBorder: '#E5E7EB',
  inputTextDark: '#111827',
  inputTextLight: '#111827',
  placeholderDark: '#94A3B8',
  placeholderLight: '#94A3B8',
  linkLight: '#1C4D8D',
  linkAccent: '#1C4D8D',
  success: '#22C55E',
  warning: '#ff9f1c',
  danger: '#f15c5c',
} as const;
