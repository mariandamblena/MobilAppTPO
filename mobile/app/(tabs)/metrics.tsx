import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius, shadows } from '@/theme';
import { StatCard } from '@/components/StatCard';
import { formatMoneyCompact } from '@/lib/money';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/categoryMeta';
import type { Metrics, ClientCategory } from '@/api/types';
import type { ApiError } from '@/api/client';

export default function MetricsScreen() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchMetrics() {
    try {
      const data = await get<Metrics>('/me/metrics');
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar las métricas.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchMetrics().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  }, []);

  const isEmpty = (metrics?.auctionsAttended ?? 0) === 0;

  return (
    <View style={styles.screen}>
      <AppBar title="Mis métricas" />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchMetrics().finally(() => setLoading(false));
          }}
        />
      ) : isEmpty ? (
        <EmptyState
          title="Todavía no participaste en ninguna subasta"
          message="Cuando te unas a una subasta, acá verás tus estadísticas de participación, pujas y ganancias."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
        >
          {/* Sección de resumen */}
          <Text style={styles.sectionLabel}>RESUMEN</Text>

          <View style={styles.statGrid}>
            <StatCard value={metrics?.auctionsAttended ?? 0} label="Subastas asistidas" />
            <StatCard value={metrics?.auctionsWon ?? 0} label="Subastas ganadas" />
          </View>

          <View style={styles.statGrid}>
            <StatCard value={formatMoneyCompact(metrics?.totalBidAmount ?? 0)} label="Total ofertado" variant="accent" />
            <StatCard value={formatMoneyCompact(metrics?.totalPaidAmount ?? 0)} label="Total pagado" variant="accent" />
          </View>

          {/* Desglose por categoría */}
          {(metrics?.byCategory?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>POR CATEGORÍA</Text>

              <View style={styles.tableCard}>
                {/* Cabecera */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.tableCellWide]}>Categoría</Text>
                  <Text style={styles.tableHeaderCell}>Asistidas</Text>
                  <Text style={styles.tableHeaderCell}>Ganadas</Text>
                </View>

                {metrics!.byCategory.map((row, index) => {
                  const cat = row.category as ClientCategory;
                  const color = CATEGORY_COLORS[cat] ?? '#9CA3AF';
                  const label = CATEGORY_LABELS[cat] ?? row.category;
                  const isLast = index === metrics!.byCategory.length - 1;

                  return (
                    <View key={row.category} style={[styles.tableRow, isLast && styles.tableRowLast]}>
                      <View style={[styles.tableCellWide, styles.categoryCell]}>
                        <View style={[styles.categoryDot, { backgroundColor: color }]} />
                        <Text style={styles.categoryLabel}>{label}</Text>
                      </View>
                      <Text style={styles.tableCell}>{row.attended}</Text>
                      <Text style={styles.tableCell}>{row.won}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  sectionLabel: {
    ...typography.overline,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tableCard: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    ...shadows.card,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tableHeaderCell: {
    flex: 1,
    ...typography.overline,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCellWide: { flex: 2 },
  tableCell: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.text.primary,
    textAlign: 'center',
  },
  categoryCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  categoryLabel: {
    ...typography.bodySmall,
    color: colors.text.primary,
    fontWeight: '600',
  },
});
