import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import { formatMoney } from '@/lib/money';
import type { MyBid } from '@/api/types';
import type { ApiError } from '@/api/client';

/**
 * Tab "Mis pujas" — pujas del cliente actual (GET /me/bids).
 * Marca "Ganando" cuando la puja es la ganadora actual del lote.
 */
export default function MisPujasScreen() {
  const router = useRouter();
  const [bids, setBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchBids() {
    try {
      setBids(await get<MyBid[]>('/me/bids'));
      setError(null);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar tus pujas.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchBids().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBids();
    setRefreshing(false);
  }, []);

  return (
    <View style={styles.container}>
      <AppBar title="Mis pujas" />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchBids().finally(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={bids}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={bids.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="Todavía no hiciste pujas"
              message="Cuando ofertes en una subasta, vas a ver acá tus pujas y si vas ganando."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push(`/item/${item.itemId}`)}
            >
              {item.photo ? (
                <Image source={{ uri: item.photo }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.info}>
                <View style={styles.topRow}>
                  <Text style={styles.lot}>LOTE {item.lotNumber}</Text>
                  {item.winner ? (
                    <View style={styles.winBadge}>
                      <Text style={styles.winText}>GANANDO</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.amount}>{formatMoney(item.amount, item.currency)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  thumb: { width: 88, height: 88, backgroundColor: colors.background.secondary },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, padding: spacing.sm, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  lot: { ...typography.overline, color: colors.text.tertiary },
  winBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.successBackground,
  },
  winText: { fontSize: 10, fontWeight: '700', color: colors.feedback.success, letterSpacing: 0.5 },
  title: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600', marginBottom: 4 },
  amount: { ...typography.heading3, color: colors.brand.primary },
});
