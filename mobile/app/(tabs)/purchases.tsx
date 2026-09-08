import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { SaleRecord } from '@/api/types';

export default function PurchasesScreen() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPurchases() {
    try {
      const data = await get<SaleRecord[]>('/sale-records');
      setPurchases(data);
      setError(null);
    } catch {
      setError('No se pudieron cargar tus compras.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchPurchases().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPurchases();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <AppBar title="Mis compras" />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => { setLoading(true); fetchPurchases().finally(() => setLoading(false)); }}
        />
      ) : (
      <FlatList
        data={purchases}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={purchases.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin compras"
            message="Todavía no ganaste ningún ítem en una subasta."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/purchase/${item.id}`)}
            activeOpacity={0.75}
          >
            {/* Left: color stripe by status */}
            <View style={[styles.stripe, paymentStripeStyle(item.paymentStatus)]} />

            <View style={styles.cardBody}>
              {/* Top row: amount + status pill */}
              <View style={styles.cardTop}>
                <Text style={styles.amount}>${item.amount.toLocaleString('es-AR')}</Text>
                <PaymentPill status={item.paymentStatus} />
              </View>

              {/* Description */}
              <Text style={styles.description} numberOfLines={1}>
                {item.product?.catalogDescription ?? `Ítem de subasta #${item.auctionId}`}
              </Text>

              {/* Bottom: date + commission */}
              <View style={styles.cardBottom}>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString('es-AR', { dateStyle: 'medium' })}
                </Text>
                <Text style={styles.commission}>
                  Comisión: ${item.commission.toLocaleString('es-AR')}
                </Text>
              </View>
            </View>

            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        )}
      />
      )}
    </View>
  );
}

function PaymentPill({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <View style={styles.pillPaid}>
        <Text style={styles.pillPaidText}>Pagado</Text>
      </View>
    );
  }
  if (status === 'failed') {
    return (
      <View style={styles.pillFailed}>
        <Text style={styles.pillFailedText}>Falló</Text>
      </View>
    );
  }
  return (
    <View style={styles.pillPending}>
      <Text style={styles.pillPendingText}>Pendiente</Text>
    </View>
  );
}

function paymentStripeStyle(status: string) {
  if (status === 'paid') return { backgroundColor: colors.feedback.success };
  if (status === 'failed') return { backgroundColor: colors.feedback.error };
  return { backgroundColor: colors.feedback.warning };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  list: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center' },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
  },
  stripe: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: spacing.sm },
  arrow: { ...typography.heading3, color: colors.text.tertiary, paddingRight: spacing.sm },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  amount: { ...typography.heading3, color: colors.brand.primary, fontWeight: '800' },

  pillPaid: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.successBackground,
  },
  pillPaidText: { ...typography.caption, color: colors.feedback.success, fontWeight: '700' },

  pillFailed: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.errorBackground,
  },
  pillFailedText: { ...typography.caption, color: colors.feedback.error, fontWeight: '700' },

  pillPending: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.warningBackground,
  },
  pillPendingText: { ...typography.caption, color: colors.feedback.warning, fontWeight: '700' },

  description: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  date: { ...typography.caption, color: colors.text.tertiary },
  commission: { ...typography.caption, color: colors.text.tertiary },
});
