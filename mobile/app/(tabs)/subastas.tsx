import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import { CATEGORY_LABELS, type CategoryKey } from '@/lib/categoryMeta';
import type { Auction } from '@/api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

type Currency = 'ARS' | 'USD';

/** Orden fijo de las tarjetas en la grilla. */
const CATEGORY_ORDER: CategoryKey[] = [
  'common',
  'special',
  'silver',
  'gold',
  'platinum',
  'colecciones',
];

interface CategoryCard {
  key: CategoryKey;
  label: string;
  count: number;
}

/** ¿La subasta pertenece a esta categoría del catálogo? */
function auctionMatchesCategory(auction: Auction, key: CategoryKey): boolean {
  if (key === 'colecciones') return auction.isCollection;
  return auction.category === key;
}

/**
 * Tab "Catálogo" — grilla de categorías de subastas. El usuario elige una categoría
 * (Común, Especial, Plata, Oro, Platino o Colecciones) y entra a ver sus piezas.
 * Reemplaza a la antigua lista de subastas (los eventos siguen accesibles desde el Home).
 */
export default function CatalogoScreen() {
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  // Filtro de moneda: ambas activas por defecto.
  const [currencies, setCurrencies] = useState<Record<Currency, boolean>>({ ARS: true, USD: true });
  // Chip "Fecha" — orden decorativo (más nuevas primero). No-op funcional.
  const [sortByDate, setSortByDate] = useState(false);

  async function fetchAuctions() {
    try {
      const [open, scheduled] = await Promise.all([
        get<Auction[]>('/auctions?status=open'),
        get<Auction[]>('/auctions?status=scheduled'),
      ]);
      setAuctions([...open, ...scheduled]);
      setError(null);
    } catch {
      setError('No se pudo cargar el catálogo.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchAuctions().finally(() => setLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAuctions();
    setRefreshing(false);
  }, []);

  const toggleCurrency = (c: Currency) =>
    setCurrencies((prev) => ({ ...prev, [c]: !prev[c] }));

  // Subastas que pasan el filtro de moneda.
  const currencyFiltered = useMemo(
    () => auctions.filter((a) => currencies[a.currency]),
    [auctions, currencies]
  );

  // Tarjetas de categoría: conteo de subastas (respetando moneda) + búsqueda por texto.
  const cards = useMemo<CategoryCard[]>(() => {
    const q = query.trim().toLowerCase();
    return CATEGORY_ORDER.map((key) => {
      const label = CATEGORY_LABELS[key];
      const matching = currencyFiltered.filter((a) => auctionMatchesCategory(a, key));
      return { key, label, count: matching.length, matching };
    })
      .filter(({ label, matching }) => {
        if (!q) return true;
        // Coincide por nombre de categoría o por ubicación de alguna de sus subastas.
        if (label.toLowerCase().includes(q)) return true;
        return matching.some((a) => (a.location ?? '').toLowerCase().includes(q));
      })
      .map(({ key, label, count }) => ({ key, label, count }));
  }, [currencyFiltered, query]);

  return (
    <View style={styles.container}>
      <AppBar />
      <Text style={styles.screenTitle}>Catálogo</Text>

      {/* Buscador */}
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.text.tertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar pieza o subasta"
          placeholderTextColor={colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      {/* Filtros: moneda + orden por fecha */}
      <View style={styles.filtersRow}>
        {(['ARS', 'USD'] as Currency[]).map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, currencies[c] && styles.chipActive]}
            onPress={() => toggleCurrency(c)}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipText, currencies[c] && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, sortByDate && styles.chipActive]}
          onPress={() => setSortByDate((v) => !v)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, sortByDate && styles.chipTextActive]}>Fecha</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.overline}>Categorías</Text>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchAuctions().finally(() => setLoading(false));
          }}
        />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.key}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={cards.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="Sin categorías"
              message="No encontramos categorías para esa búsqueda. Probá con otro término."
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/catalog/${item.key}`)}
              activeOpacity={0.75}
            >
              <View style={styles.cardImg}>
                <Feather name="image" size={26} color={colors.text.tertiary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.label}</Text>
                <Text style={styles.cardMeta}>{item.count} subastas</Text>
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

  screenTitle: {
    ...typography.heading2,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
  },

  filtersRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  chipActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  chipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  overline: {
    ...typography.overline,
    color: colors.text.secondary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },

  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  row: { gap: spacing.sm, marginBottom: spacing.sm },

  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  cardImg: {
    height: 88,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: spacing.sm },
  cardName: { ...typography.label, color: colors.text.primary, fontWeight: '700', marginBottom: 2 },
  cardMeta: { ...typography.caption, color: colors.text.tertiary },
});
