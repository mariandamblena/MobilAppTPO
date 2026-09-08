import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius, shadows } from '@/theme';
import { formatMoney } from '@/lib/money';
import type { Auction, AuctionCatalog, Metrics, AuctionStatus, ClientCategory } from '@/api/types';
import type { ApiError } from '@/api/client';

/** Lote del feed = ítem de catálogo + contexto de su subasta. */
interface FeedLot {
  id: number;
  lotNumber: number;
  title: string;
  basePrice?: number | null;
  status: string;
  photo?: string | null;
  auctionId: number;
  currency: 'ARS' | 'USD';
  auctionStatus: AuctionStatus;
  category: ClientCategory;
  location?: string | null;
  startsAt: string;
}

/** Tiempo relativo hasta una fecha futura: "4 h", "2 d", "30 min". */
function startsIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'pronto';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

function lotsFromCatalogs(
  entries: ({ auction: Auction; catalog: AuctionCatalog } | null)[],
  options: { onlyActive?: boolean } = {}
): FeedLot[] {
  const feed: FeedLot[] = [];
  for (const entry of entries) {
    if (!entry) continue;
    for (const it of entry.catalog.items) {
      if (it.status === 'sold' || it.status === 'unsold') continue;
      if (options.onlyActive && it.status !== 'active') continue;
      feed.push({
        id: it.id,
        lotNumber: it.lotNumber,
        title: it.catalogDescription ?? `Lote ${it.lotNumber}`,
        basePrice: it.basePrice,
        status: it.status,
        photo: it.photo,
        auctionId: entry.auction.id,
        currency: entry.auction.currency,
        auctionStatus: entry.auction.status,
        category: entry.auction.category,
        location: entry.auction.location,
        startsAt: entry.auction.startsAt,
      });
    }
  }
  return feed;
}

async function fetchLotsFor(
  status: AuctionStatus,
  options: { onlyActive?: boolean } = {}
): Promise<FeedLot[]> {
  const auctions = await get<Auction[]>(`/auctions?status=${status}`);
  const catalogs = await Promise.all(
    auctions.map((a) =>
      get<AuctionCatalog>(`/auctions/${a.id}/catalog`)
        .then((c) => ({ auction: a, catalog: c }))
        .catch(() => null)
    )
  );
  return lotsFromCatalogs(catalogs, options);
}

/**
 * Home (decisión D2) — feed de lotes en vivo + sección "Siguientes subastas".
 * Nota de datos: el modelo no tiene timer por ítem (1 ítem activo por vez), así que las
 * cards en vivo no muestran countdown; las próximas muestran "empieza en X" (real, desde startsAt).
 */
export default function HomeScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [liveLots, setLiveLots] = useState<FeedLot[]>([]);
  const [upcomingLots, setUpcomingLots] = useState<FeedLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga única del Home: métricas + lotes en vivo (open) + próximos (scheduled).
  // Cada status trae su propio listado de subastas y luego se hace fan-out de catálogos;
  // memoizada para no recrearla en cada render (la consumen el focus effect y el refresh).
  const fetchHome = useCallback(async () => {
    try {
      const [m, live, upcoming] = await Promise.all([
        get<Metrics>('/me/metrics').catch(() => null),
        fetchLotsFor('open', { onlyActive: true }),
        fetchLotsFor('scheduled'),
      ]);
      setMetrics(m);
      setLiveLots(live);
      setUpcomingLots(upcoming);
      setError(null);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudo cargar el inicio.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchHome().finally(() => setLoading(false));
    }, [fetchHome])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHome();
    setRefreshing(false);
  }, [fetchHome]);

  const remindMe = useCallback((lot: FeedLot) => {
    Alert.alert('Recordatorio', `Te avisaremos cuando empiece la subasta de "${lot.title}".`);
  }, []);

  const header = useMemo(
    () => (
    <View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardAlt]}>
          <Text style={styles.statLabel}>TOTAL PARTICIPACIONES</Text>
          <Text style={styles.statValue}>{metrics?.auctionsAttended ?? 0}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>SUBASTAS GANADAS</Text>
          <Text style={styles.statValue}>{String(metrics?.auctionsWon ?? 0).padStart(2, '0')}</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.sectionTitle}>Subastas en vivo</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/subastas')} hitSlop={6}>
          <Text style={styles.sectionLink}>Ver todo</Text>
        </TouchableOpacity>
      </View>
    </View>
    ),
    [metrics, router]
  );

  const footer = useMemo(
    () =>
    upcomingLots.length > 0 ? (
      <View style={styles.upcomingSection}>
        <Text style={styles.upcomingTitle}>Siguientes subastas</Text>
        {upcomingLots.map((lot) => (
          <View key={lot.id} style={styles.upcomingCard}>
            {lot.photo ? (
              <Image source={{ uri: lot.photo }} style={styles.upcomingImage} />
            ) : (
              <View style={[styles.upcomingImage, styles.imagePlaceholder]}>
                <Feather name="image" size={24} color={colors.text.tertiary} />
              </View>
            )}
            <View style={styles.upcomingBadge}>
              <Feather name="clock" size={11} color={colors.text.inverse} />
              <Text style={styles.upcomingBadgeText}>EMPIEZA EN {startsIn(lot.startsAt)}</Text>
            </View>
            <View style={styles.upcomingBody}>
              <Text style={styles.upcomingName} numberOfLines={1}>{lot.title}</Text>
              <Text style={styles.upcomingEst}>
                {lot.basePrice != null ? `Base ${formatMoney(lot.basePrice, lot.currency)}` : 'Base a confirmar'}
              </Text>
              <Button
                title="RECORDARME"
                variant="outline"
                onPress={() => remindMe(lot)}
                rightIcon={<Feather name="bell" size={15} color={colors.brand.primary} />}
                style={styles.remindBtn}
              />
            </View>
          </View>
        ))}
      </View>
    ) : null,
    [upcomingLots, remindMe]
  );

  return (
    <View style={styles.container}>
      <AppBar />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchHome().finally(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={liveLots}
          keyExtractor={(l) => String(l.id)}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />}
          ListEmptyComponent={
            <EmptyState
              title="No hay lotes en vivo"
              message="Cuando haya una subasta en curso vas a ver los lotes acá para pujar."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/item/${item.id}`)}>
              <View style={styles.imageWrap}>
                {item.photo ? (
                  <Image source={{ uri: item.photo }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.imagePlaceholder]}>
                    <Feather name="image" size={28} color={colors.text.tertiary} />
                  </View>
                )}
                <View style={styles.badgesRow}>
                  {item.auctionStatus === 'open' ? (
                    <View style={styles.liveBadge}>
                      <View style={styles.liveBadgeDot} />
                      <Text style={styles.liveBadgeText}>VIVO</Text>
                    </View>
                  ) : null}
                  <View style={styles.catBadge}>
                    <Text style={styles.catBadgeText}>{item.category.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.body}>
                <Text style={styles.lotOverline}>LOTE {item.lotNumber}</Text>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                {item.location ? (
                  <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
                ) : null}

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>PRECIO BASE</Text>
                    <Text style={styles.price}>
                      {item.basePrice != null ? formatMoney(item.basePrice, item.currency) : '—'}
                    </Text>
                  </View>
                  <Button
                    title="PUJAR"
                    variant="accent"
                    onPress={() => router.push(`/auction/${item.auctionId}`)}
                    rightIcon={<Feather name="arrow-right" size={16} color={colors.text.inverse} />}
                    style={styles.cta}
                  />
                </View>
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
  list: { padding: spacing.md, paddingBottom: spacing.xl },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  statCardAlt: { backgroundColor: colors.brand.primaryAccent },
  statLabel: { ...typography.overline, color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 30, color: colors.text.inverse, marginTop: spacing.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.feedback.live },
  sectionTitle: { ...typography.heading3, color: colors.text.primary },
  sectionLink: { ...typography.label, color: colors.brand.primaryStrong },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.cardStrong,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 180, backgroundColor: colors.background.secondary },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  badgesRow: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.feedback.live,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  catBadge: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 1 },

  body: { padding: spacing.md },
  lotOverline: { ...typography.overline, color: colors.text.tertiary, marginBottom: 2 },
  title: { ...typography.heading3, color: colors.text.primary, marginBottom: 2 },
  location: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.sm },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  priceLabel: { ...typography.overline, color: colors.text.tertiary, fontSize: 10 },
  price: { ...typography.heading2, color: colors.brand.primary },
  cta: { paddingHorizontal: spacing.lg },

  // ── Siguientes subastas ──
  upcomingSection: { marginTop: spacing.sm },
  upcomingTitle: { ...typography.heading3, color: colors.text.primary, marginBottom: spacing.sm },
  upcomingCard: {
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.cardStrong,
  },
  upcomingImage: { width: '100%', height: 140, backgroundColor: colors.background.secondary },
  upcomingBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  upcomingBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  upcomingBody: { padding: spacing.md },
  upcomingName: { ...typography.heading3, color: colors.text.primary, marginBottom: 2 },
  upcomingEst: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.sm },
  remindBtn: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg },
});
