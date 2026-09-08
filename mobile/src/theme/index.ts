/**
 * Barrel del theme de Auctify. Importar siempre desde `@/theme`:
 *   import { colors, typography, spacing } from '@/theme';
 *
 * TODO: sincronizar TODOS los tokens (colores, tipografía, spacing) con el
 * Figma `Auctify - DA1.fig` para mantener la trazabilidad de diseño exigida.
 */
export { colors } from './colors';
export { typography, fonts } from './typography';
export { spacing, radius } from './spacing';
export { shadows } from './shadows';

export type { TypographyToken } from './typography';
export type { SpacingToken, RadiusToken } from './spacing';
