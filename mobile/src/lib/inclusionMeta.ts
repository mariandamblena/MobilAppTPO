/**
 * Metadatos de estado de solicitudes de inclusión. Importar desde `@/lib/inclusionMeta`.
 *
 * Etiquetas/colores canónicos para `InclusionRequestStatus`. Unifica los mapas que antes
 * estaban duplicados (y con etiquetas inconsistentes) entre la lista de piezas
 * (`app/(tabs)/items.tsx`) y el detalle de la solicitud (`app/items/[id]/index.tsx`).
 */
import type { InclusionRequestStatus } from '@/api/types';
import { colors } from '@/theme';

/** Etiqueta legible canónica por estado. */
export const STATUS_LABELS: Record<InclusionRequestStatus, string> = {
  pending: 'Pendiente de revisión',
  under_inspection: 'En inspección',
  proposal_sent: 'Propuesta recibida',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  proposal_rejected: 'Propuesta rechazada',
};

/** Color canónico por estado. */
export const STATUS_COLORS: Record<InclusionRequestStatus, string> = {
  pending: colors.feedback.warning,
  under_inspection: colors.feedback.info,
  proposal_sent: colors.brand.primary,
  accepted: colors.feedback.success,
  rejected: colors.feedback.error,
  proposal_rejected: colors.feedback.error,
};
