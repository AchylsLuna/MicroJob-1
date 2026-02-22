export const tokens = {
  colors: {
    background: '#f4f7fc',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    border: '#d8e1ee',
    text: '#0f172a',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',
    brand: '#1c4d8d',
    brandSoft: '#e8f0fb',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    white: '#ffffff',
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    pill: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
  },
  typography: {
    h1: 26,
    h2: 22,
    h3: 18,
    body: 14,
    caption: 12,
  },
  shadow: {
    card: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 18,
      elevation: 4,
    },
  },
} as const;

