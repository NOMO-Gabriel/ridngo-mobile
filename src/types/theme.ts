export const LightColors = {
  orange: '#FF8C00',
  orangeLight: '#FFA333',
  orangeDark: '#CC7000',
  orangeBg: 'rgba(255, 140, 0, 0.12)',

  dark: '#FFFFFF',
  darkCard: '#F5F5F5',
  darkBorder: '#E0E0E0',

  white: '#0D0D0D',
  offWhite: '#1A1A1A',

  text: '#0D0D0D',
  textSecondary: 'rgba(0,0,0,0.55)',
  textMuted: 'rgba(0,0,0,0.35)',

  green: '#16A34A',
  greenBg: 'rgba(22, 163, 74, 0.1)',
  red: '#DC2626',
  redBg: 'rgba(220, 38, 38, 0.1)',
  blue: '#2563EB',

  card: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.08)',

  input: 'rgba(0,0,0,0.05)',
  inputBorder: 'rgba(0,0,0,0.12)',
  inputFocus: '#FF8C00',

  background: '#F2F2F7',
  statusBar: 'dark' as 'dark' | 'light',
};

export const DarkColors = {
  orange: '#FF8C00',
  orangeLight: '#FFA333',
  orangeDark: '#CC7000',
  orangeBg: 'rgba(255, 140, 0, 0.1)',

  dark: '#0D0D0D',
  darkCard: '#1A1A1A',
  darkBorder: '#2A2A2A',

  white: '#FFFFFF',
  offWhite: '#FAF3DD',

  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.5)',
  textMuted: 'rgba(255,255,255,0.3)',

  green: '#22C55E',
  greenBg: 'rgba(34, 197, 94, 0.1)',
  red: '#EF4444',
  redBg: 'rgba(239, 68, 68, 0.1)',
  blue: '#3B82F6',

  card: '#1C1C1C',
  cardBorder: 'rgba(255,255,255,0.07)',

  input: 'rgba(255,255,255,0.07)',
  inputBorder: 'rgba(255,255,255,0.1)',
  inputFocus: '#FF8C00',

  background: '#0D0D0D',
  statusBar: 'light' as 'dark' | 'light',
};

// Default export for backward compat — will be overridden by context
export const Colors = DarkColors;

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 16, lg: 24, xl: 32, full: 9999,
};