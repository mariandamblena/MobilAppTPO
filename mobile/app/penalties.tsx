/**
 * Pantalla de multas (F10 — Multas).
 * Accesible via router.push('/penalties') desde el perfil, el banner de cuenta
 * bloqueada o desde una notificación de tipo 'penalty' (F09).
 *
 * TODO
 *
 * Flujo:
 *  - Carga la lista de multas del cliente autenticado (GET /me/penalties).
 *  - Muestra un banner de cuenta bloqueada si hay multas pendientes.
 *  - Cada fila: amount, status badge, fecha. Si pending → botón "Pagar multa".
 *  - Al pagar: Alert de confirmación → POST /penalties/:id/pay →
 *      · clientUnblocked=true  → "Multa pagada. Tu cuenta fue desbloqueada."
 *      · clientUnblocked=false → "Multa pagada. Tenés otras multas pendientes."
 */

import { useState, useCallback } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { get, post } from '@/api/client';
import { ApiError } from '@/api/client';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, typography, spacing, radius } from '@/theme';
import { useFocusEffect } from 'expo-router';

// ─────────────── Tipos ───────────────

export type PenaltyStatus = 'pending' | 'paid';

export interface Penalty {
  id: number;
  clientId: number;
  auctionId: number;
  itemId: number;
  amount: number;
  status: PenaltyStatus;
  createdAt: string;
  paidAt: string | null;
}

interface PayResponse extends Penalty {
  clientUnblocked: boolean;
}

// ─────────────── Helpers de formato ───────────────

/** Formatea el monto en pesos argentinos. */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Formatea una fecha ISO al estilo local argentino. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ─────────────── Componente badge de estado ───────────────

function StatusBadge({ status }: { status: PenaltyStatus }) {
  // Badge visual: rojo para pendiente, verde para pagado
  const isPending = status === 'pending';
  return (
    <View style={[styles.badge, isPending ? styles.badgePending : styles.badgePaid]}>
      <Text style={[styles.badgeText, isPending ? styles.badgeTextPending : styles.badgeTextPaid]}>
        {isPending ? 'PENDIENTE' : 'PAGADO'}
      </Text>
    </View>
  );
}

// ─────────────── Componente fila de multa ───────────────

interface PenaltyRowProps {
  penalty: Penalty;
  onPay: (penalty: Penalty) => void;
  payingId: number | null;
}

function PenaltyRow({ penalty, onPay, payingId }: PenaltyRowProps) {
  const isPending = penalty.status === 'pending';
  const isPayingThis = payingId === penalty.id;

  return (
    <View style={styles.row}>
      {/* Encabezado: monto + badge de estado */}
      <View style={styles.rowHeader}>
        <Text style={styles.amount}>{formatAmount(penalty.amount)}</Text>
        <StatusBadge status={penalty.status} />
      </View>

      {/* Metadatos: subasta, ítem, fecha */}
      <View style={styles.rowMeta}>
        <Text style={styles.metaText}>Subasta #{penalty.auctionId} · Ítem #{penalty.itemId}</Text>
        <Text style={styles.metaDate}>
          {isPending
            ? `Generada el ${formatDate(penalty.createdAt)}`
            : `Pagada el ${penalty.paidAt ? formatDate(penalty.paidAt) : formatDate(penalty.createdAt)}`}
        </Text>
      </View>

      {/* Botón de pago — solo visible si la multa está pendiente */}
      {isPending && (
        <Button
          title="Pagar multa"
          variant="primary"
          loading={isPayingThis}
          disabled={payingId !== null}
          onPress={() => onPay(penalty)}
          style={styles.payButton}
        />
      )}
    </View>
  );
}

// ─────────────── Pantalla principal ───────────────

export default function PenaltiesScreen() {
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // ID de la multa que está en proceso de pago (deshabilita los demás botones)
  const [payingId, setPayingId] = useState<number | null>(null);

  // ── Carga de datos ──

  const fetchPenalties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // GET /me/penalties — historial completo del cliente autenticado
      const data = await get<Penalty[]>('/me/penalties');
      setPenalties(data);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : 'No se pudieron cargar las multas. Reintentá.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recargar cada vez que la pantalla gana foco (navegación de vuelta)
  useFocusEffect(
    useCallback(() => {
      void fetchPenalties();
    }, [fetchPenalties]),
  );

  // ── Pago de multa ──

  async function handlePay(penalty: Penalty) {
    // Confirmación vía Alert antes de ejecutar el pago
    Alert.alert(
      'Confirmar pago',
      `¿Confirmás el pago de la multa de ${formatAmount(penalty.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          style: 'destructive',
          onPress: () => executePay(penalty),
        },
      ]
    );
  }

  async function executePay(penalty: Penalty) {
    setPayingId(penalty.id);
    try {
      // POST /penalties/:id/pay — devuelve { ...penalty, clientUnblocked: boolean }
      const result = await post<PayResponse>(`/penalties/${penalty.id}/pay`, {});

      // Actualizar la lista localmente (reemplazar la multa pagada)
      setPenalties((prev) =>
        prev.map((p) => (p.id === penalty.id ? result : p))
      );

      // Toast diferenciado según si el cliente quedó desbloqueado o no
      const message = result.clientUnblocked
        ? 'Multa pagada. Tu cuenta fue desbloqueada.'
        : 'Multa pagada. Tenés otras multas pendientes.';

      Alert.alert('Pago exitoso', message);
    } catch (err) {
      let message = 'Algo salió mal al procesar el pago. Reintentá.';

      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_ERROR') {
          message = 'Esta multa ya estaba pagada.';
        } else {
          message = err.message;
        }
      }

      Alert.alert('Error', message);
    } finally {
      setPayingId(null);
    }
  }

  // ── Estados de la lista ──

  if (loading) {
    return (
      <View style={styles.screenWrap}>
        <AppBar title="Mis multas" />
        <Loading message="Cargando multas…" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screenWrap}>
        <AppBar title="Mis multas" />
        <ErrorView message={error} onRetry={fetchPenalties} />
      </View>
    );
  }

  // Verificar si hay multas pendientes para mostrar el banner de bloqueo
  const hasPending = penalties.some((p) => p.status === 'pending');

  return (
    <ScreenContainer header={<AppBar title="Mis multas" />}>
      {/* Banner de cuenta bloqueada — visible si hay multas pendientes.
          Se relaciona con el error CLIENT_BLOCKED en F04 (connect) y F05 (bids). */}
      {hasPending && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedBannerText}>
            Tu cuenta está bloqueada hasta pagar las multas pendientes.
          </Text>
        </View>
      )}

      {/* Lista de multas */}
      <FlatList
        data={penalties}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={false}
        contentContainerStyle={penalties.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={
          <EmptyState
            title="No tenés multas registradas"
            message="Cuando se genere una multa por impago aparecerá aquí."
          />
        }
        renderItem={({ item }) => (
          <PenaltyRow
            penalty={item}
            onPay={handlePay}
            payingId={payingId}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ScreenContainer>
  );
}

// ─────────────── Estilos ───────────────

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.background.primary },

  // ── Banner de cuenta bloqueada ──
  blockedBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderLeftWidth: 4,
    borderLeftColor: colors.feedback.error,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  blockedBannerText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
    fontWeight: '600',
  },

  // ── Fila de multa ──
  row: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  amount: {
    ...typography.heading3,
    color: colors.text.primary,
  },
  rowMeta: {
    marginBottom: spacing.sm,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  metaDate: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  payButton: {
    marginTop: spacing.sm,
  },

  // ── Badge de estado ──
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgePending: {
    backgroundColor: colors.feedback.errorBackground,
    borderWidth: 1,
    borderColor: colors.feedback.error,
  },
  badgePaid: {
    backgroundColor: colors.feedback.successBackground,
    borderWidth: 1,
    borderColor: colors.feedback.success,
  },
  badgeText: {
    ...typography.overline,
    fontSize: 10,
  },
  badgeTextPending: {
    color: colors.feedback.error,
  },
  badgeTextPaid: {
    color: colors.feedback.success,
  },

  // ── Lista ──
  separator: {
    height: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 200,
  },
});
