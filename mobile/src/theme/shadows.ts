import type { ViewStyle } from 'react-native';

/**
 * Sombras de tarjetas de Auctify. Importar desde `@/theme`.
 *
 * - `card`: sombra suave (cards de listas/notificaciones).
 * - `cardStrong`: sombra más marcada (cards destacadas del Home).
 *
 * Los valores se conservan idénticos a los consts `CARD_SHADOW` locales que reemplazan,
 * incluyendo el `shadowColor` (no se unifican para no alterar el render).
 */
export const shadows = {
  /** Sombra suave — opacidad 0.06, radio 4. */
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  /** Sombra marcada — opacidad 0.08, radio 16. */
  cardStrong: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const satisfies Record<string, ViewStyle>;
