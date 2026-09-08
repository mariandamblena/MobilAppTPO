/**
 * Escala de espaciado y radios de Auctify.
 *
 * ✅ EXTRAÍDA DEL FIGMA `Auctify - DA1`: spacing en múltiplos de 4 (4/8/16/24/32/40) y
 * radios 12/16/24/32/40 + pill.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

/** Radios de borde del diseño. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  /** Cards destacadas (Featured Card). */
  xxl: 40,
  /** Pills / badges / avatares. */
  pill: 9999,
} as const;

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
