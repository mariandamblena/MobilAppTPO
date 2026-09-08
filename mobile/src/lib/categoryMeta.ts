/**
 * Metadatos de categorías de cliente/subasta. Importar desde `@/lib/categoryMeta`.
 *
 * Etiquetas canónicas en español: Común / Especial / Plata / Oro / Platino / Colecciones.
 * (Antes el Perfil mostraba "Silver/Gold/Platinum" mientras el Catálogo mostraba
 * "Plata/Oro/Platino"; acá quedan unificadas en la versión en español.)
 */
import type { ClientCategory } from '@/api/types';

/** Clave de categoría del catálogo: las del cliente + la pseudo-categoría "colecciones". */
export type CategoryKey = ClientCategory | 'colecciones';

/** Etiquetas en español de cada categoría (incluye "colecciones"). */
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  common: 'Común',
  special: 'Especial',
  silver: 'Plata',
  gold: 'Oro',
  platinum: 'Platino',
  colecciones: 'Colecciones',
};

/** Color asociado a cada categoría de cliente (usado en el desglose de métricas). */
export const CATEGORY_COLORS: Record<ClientCategory, string> = {
  common: '#9CA3AF',
  special: '#6B7280',
  silver: '#94A3B8',
  gold: '#F59E0B',
  platinum: '#8B5CF6',
};
