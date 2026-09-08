/**
 * Paleta de colores de Auctify.
 *
 * ✅ Tokens EXTRAÍDOS DEL FIGMA `Auctify - DA1` (pantalla "High-Fidelity: Home", node 35:1431).
 * Identidad: azul profundo de marca (#1e3a8a) + acento marrón cálido (martillo/madera de
 * remate) + neutros slate. Verde para "en vivo/termina pronto", rojo para "VIVO".
 */
export const colors = {
  brand: {
    /** Azul profundo — color principal (headings, precios, logo, CTA secundario). */
    primary: '#1E3A8A',
    /** Azul brillante — estados activos / links (nav activo). */
    primaryStrong: '#1D4ED8',
    /** Azul medio — usado en tarjetas/acentos secundarios. */
    primaryAccent: '#0058BE',
    /** Variante clara del primario — chips, fondos sutiles, fila activa. */
    primaryLight: '#DBEAFE',
    /** Acento marrón cálido — botón "PUJAR" destacado, urgencia. */
    accent: '#6E2D00',
    /** Marrón fuerte — fondo del CTA destacado. */
    accentStrong: '#4B1C00',
    /** Variante clara del acento. */
    accentLight: '#FEF3C7',
  },

  background: {
    /** Fondo principal de pantallas. */
    primary: '#F8F9FA',
    /** Fondo secundario — secciones, inputs, divisores suaves. */
    secondary: '#F1F5F9',
    /** Fondo de cards. */
    card: '#FFFFFF',
    /** Fondo highlight (notificación no leída, fila activa). */
    highlight: '#DBEAFE',
  },

  text: {
    /** Texto principal oscuro — cuerpo, inputs. */
    primary: '#0F172A',
    /** Texto secundario — subtítulos, descripciones. */
    secondary: '#64748B',
    /** Texto terciario — hints, timestamps, micro-labels. */
    tertiary: '#94A3B8',
    /** Texto de marca — títulos y precios en azul. */
    brand: '#1E3A8A',
    /** Texto sobre fondo oscuro / botones primarios. */
    inverse: '#FFFFFF',
  },

  border: {
    /** Borde default de inputs, cards, divisores. */
    default: '#F1F5F9',
    /** Borde medio (inputs con más contraste). */
    strong: '#E2E8F0',
    /** Borde activo / focused. */
    active: '#1E3A8A',
    /** Borde de error. */
    error: '#EF4444',
  },

  feedback: {
    error: '#DC2626',
    errorBackground: '#FEF2F2',
    /** Verde esmeralda — "en vivo / termina pronto / verificado". */
    success: '#10B981',
    successBackground: '#ECFDF5',
    warning: '#D97706',
    warningBackground: '#FFFBEB',
    info: '#2563EB',
    infoBackground: '#EFF6FF',
    /** Rojo "VIVO" (badge de subasta en curso). */
    live: '#EF4444',
  },
} as const;
