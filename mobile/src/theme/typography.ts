import { Platform, type TextStyle } from 'react-native';

/**
 * Tipografía de Auctify.
 *
 * ✅ EXTRAÍDA DEL FIGMA `Auctify - DA1`: **Manrope** (ExtraBold) para títulos +
 * **Inter** para cuerpo/UI + monoespaciada para timers.
 *
 * Las familias se cargan en `app/_layout.tsx` con `@expo-google-fonts/*`.
 * Criterio de legibilidad (corrección E1 "letra muy chica"): el cuerpo es 16; los micro-labels
 * de 10–11px se reservan SOLO para etiquetas en mayúscula con tracking (como en el diseño).
 */
export const fonts = {
  /** Títulos display (Manrope ExtraBold). */
  display: 'Manrope_800ExtraBold',
  /** Títulos (Manrope Bold). */
  heading: 'Manrope_700Bold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  /** Monoespaciada para contadores/timers (ej. "04:12:09"). */
  mono: Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' }) as string,
} as const;

export const typography = {
  /** Números/precios grandes (stats, puja actual). */
  display: { fontFamily: fonts.bold, fontSize: 34, fontWeight: '800', lineHeight: 40, letterSpacing: -0.5 },
  /** Título de sección. */
  heading1: { fontFamily: fonts.display, fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.75 },
  heading2: { fontFamily: fonts.display, fontSize: 24, fontWeight: '800', lineHeight: 32, letterSpacing: -0.6 },
  heading3: { fontFamily: fonts.bold, fontSize: 19, fontWeight: '700', lineHeight: 26 },
  /** Texto base — mínimo legible recomendado. */
  body: { fontFamily: fonts.body, fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodySmall: { fontFamily: fonts.body, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  /** Labels de formulario y botones. */
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  /** Micro-label en mayúscula con tracking (ej. "PUJA ACTUAL", badges, nav). */
  overline: { fontFamily: fonts.bold, fontSize: 11, fontWeight: '700', lineHeight: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  caption: { fontFamily: fonts.body, fontSize: 12, fontWeight: '400', lineHeight: 16 },
} as const satisfies Record<string, TextStyle>;

export type TypographyToken = keyof typeof typography;
