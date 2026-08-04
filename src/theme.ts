/**
 * Roojifeel theme — Cybertron Console design language.
 * Deep space background, glassy surfaces, purple→teal→pink tri-color,
 * glow shadows, uppercase micro-labels, fast subtle motion.
 */
import { Easing } from 'react-native-reanimated';

export const theme = {
  colors: {
    // Base
    background: '#0b0d12',
    surface: 'rgba(22, 25, 34, 0.7)',
    surfaceSolid: '#161922',
    surfaceHover: 'rgba(30, 34, 46, 0.85)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderBright: 'rgba(255, 255, 255, 0.15)',
    // Text
    ink: '#e6e8ef',
    inkSoft: '#9ca3af',
    inkFaint: '#6b7280',
    // Brand tri-color
    purple: '#7c3aed',
    purpleSoft: '#a78bfa',
    teal: '#14b8a6',
    tealSoft: '#2dd4bf',
    pink: '#ec4899',
    pinkSoft: '#f472b6',
    blue: '#3b82f6',
    // Semantic
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    accent: '#7c3aed',
    tabBar: 'rgba(11, 13, 18, 0.92)',
    tabInactive: '#6b7280',
  },
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
  // Motion — fast and subtle, cubic-bezier(0.4, 0, 0.2, 1)
  motion: {
    fast: 150,
    base: 250,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
} as const;

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
