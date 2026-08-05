/**
 * Roojifeel theme — the Roojifeel design language, now in dark and light.
 *
 * The palette is resolved ONCE at JS boot (see index.js → bootTheme) by
 * mutating this shared object before any screen module creates its
 * StyleSheets. Changing the theme in Settings persists the mode and takes
 * effect on the next launch.
 */
import { Appearance } from 'react-native';
import { Easing } from 'react-native-reanimated';

export type ThemeMode = 'dark' | 'light' | 'system';

const darkColors = {
  background: '#0b0d12',
  surface: 'rgba(22, 25, 34, 0.7)',
  surfaceSolid: '#161922',
  surfaceHover: 'rgba(30, 34, 46, 0.85)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderBright: 'rgba(255, 255, 255, 0.15)',
  ink: '#e6e8ef',
  inkSoft: '#9ca3af',
  inkFaint: '#6b7280',
  purple: '#7c3aed',
  purpleSoft: '#a78bfa',
  teal: '#14b8a6',
  tealSoft: '#2dd4bf',
  pink: '#ec4899',
  pinkSoft: '#f472b6',
  blue: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  accent: '#7c3aed',
  tabBar: 'rgba(11, 13, 18, 0.92)',
  tabInactive: '#6b7280',
};

const lightColors: typeof darkColors = {
  background: '#F7F3EC',
  surface: 'rgba(255, 255, 255, 0.78)',
  surfaceSolid: '#FFFFFF',
  surfaceHover: 'rgba(255, 255, 255, 0.95)',
  border: 'rgba(59, 48, 73, 0.10)',
  borderBright: 'rgba(59, 48, 73, 0.20)',
  ink: '#2A2138',
  inkSoft: '#6E6580',
  inkFaint: '#9A91A8',
  purple: '#7c3aed',
  purpleSoft: '#6d28d9',
  teal: '#0d9488',
  tealSoft: '#0f766e',
  pink: '#db2777',
  pinkSoft: '#be185d',
  blue: '#2563eb',
  success: '#059669',
  danger: '#dc2626',
  warning: '#d97706',
  accent: '#7c3aed',
  tabBar: 'rgba(255, 255, 255, 0.94)',
  tabInactive: '#9A91A8',
};

export const theme = {
  /** Resolved scheme after boot: 'dark' | 'light'. */
  scheme: 'dark' as 'dark' | 'light',
  /** StatusBar style matching the scheme. */
  statusBar: 'light' as 'light' | 'dark',
  colors: { ...darkColors },
  gradients: {
    primary: ['#7c3aed', '#14b8a6', '#ec4899'] as const,
    primaryDim: ['rgba(124, 58, 237, 0.16)', 'rgba(20, 184, 166, 0.08)'] as const,
    card: ['rgba(124, 58, 237, 0.10)', 'rgba(20, 184, 166, 0.06)'] as const,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  fonts: {
    regular: 'Manrope_400Regular',
    semibold: 'Manrope_600SemiBold',
    bold: 'Manrope_700Bold',
    extrabold: 'Manrope_800ExtraBold',
    display: 'SpaceGrotesk_700Bold',
    displayMedium: 'SpaceGrotesk_500Medium',
    arRegular: 'IBMPlexSansArabic_400Regular',
    arSemibold: 'IBMPlexSansArabic_600SemiBold',
    arBold: 'IBMPlexSansArabic_700Bold',
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    glow: {
      shadowColor: '#7c3aed',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 6,
    },
  },
  motion: {
    fast: 150,
    base: 250,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  /**
   * Scheme-aware overlay: subtle fills/tracks that were white-on-dark
   * become black-on-light automatically.
   */
  o(opacity: number): string {
    return this.scheme === 'dark'
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(30, 20, 50, ${opacity})`;
  },
};

/** Resolve and apply a theme mode. MUST run before screen modules load. */
export function initTheme(mode: ThemeMode): void {
  const resolved: 'dark' | 'light' =
    mode === 'system' ? (Appearance.getColorScheme() === 'light' ? 'light' : 'dark') : mode;
  theme.scheme = resolved;
  theme.statusBar = resolved === 'light' ? 'dark' : 'light';
  Object.assign(theme.colors, resolved === 'light' ? lightColors : darkColors);
  if (resolved === 'light') {
    theme.shadow.card.shadowOpacity = 0.10;
    theme.shadow.glow.shadowOpacity = 0.25;
  }
}

/** Pick the right font family for the active language. */
export function font(lang: string, weight: 'regular' | 'semibold' | 'bold' | 'extrabold'): string {
  if (lang === 'ar') {
    const map = {
      regular: theme.fonts.arRegular,
      semibold: theme.fonts.arSemibold,
      bold: theme.fonts.arBold,
      extrabold: theme.fonts.arBold,
    } as const;
    return map[weight];
  }
  const map = {
    regular: theme.fonts.regular,
    semibold: theme.fonts.semibold,
    bold: theme.fonts.bold,
    extrabold: theme.fonts.extrabold,
  } as const;
  return map[weight];
}

/** Display font for hero titles — Space Grotesk for Latin, Plex bold for Arabic. */
export function displayFont(lang: string): string {
  return lang === 'ar' ? theme.fonts.arBold : theme.fonts.display;
}
