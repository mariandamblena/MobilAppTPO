import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import { CATEGORY_LABELS, type CategoryKey } from '@/lib/categoryMeta';
import type { Auction, AuctionCatalog } from '@/api/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.sm) / 2;

/** Pieza del catálogo de una categoría (ítem aplanado de todas las subastas que matchean). */
interface CategoryPiece {
  id: number;
  lotNumber: number;
  catalogDescription?: string | null;
  basePrice?: number | null;
  status: string;
  photo?: string | null;
}

function auctionMatchesCategory(auction: Auction, key: CategoryKey): boolean {
  if (key === 'colecciones') return auction.isCollection;
  return auction.category === key;
}

/** Aplana los ítems de varios catálogos, descartando los ya vendidos o no vendidos. */
function piecesFromCatalogs(catalogs: (AuctionCatalog | null)[]): CategoryPiece[] {
  const pieces: CategoryPiece[] = [];
  for (const catalog of catalogs) {
    if (!catalog) continue;
    for (const it of catalog.items) {
      if (it.status === 'sold' || it.status === 'unsold') continue;
      pieces.push({
        id: it.id,
        lotNumber: it.lotNumber,
        catalogDescription: it.catalogDescription,
        basePrice: it.basePrice,
        status: it.status,
        photo: it.photo,
      });
    }
  }
  return pieces;
}

/**
 * Pantalla de piezas de una categoría del catálogo. Trae las subastas open + scheduled,
 * filtra las que pertenecen a la categoría, baja sus catálogos y aplana las piezas en una
 * grilla de 2 columnas (mismo look que el catálogo de una subasta).
 */
export default function CatalogCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const key = category as CategoryKey;
  const label = CATEGORY_LABELS[key] ?? 'Catálogo';

  const [pieces, setPieces] = useState<CategoryPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [open, scheduled] = await Promise.all([
        get<Auction[]>('/auctions?status=open'),
        get<Auction[]>('/auctions?status=scheduled'),
      ]);
      const matching = [...open, ...scheduled].filter((a) => auctionMatchesCategory(a, key));
      const catalogs = await Promise.all(
        matching.map((a) =>
          get<AuctionCatalog>(`/auctions/${a.id}/catalog`).catch(() => null)
        )
      );
      setPieces(piecesFromCatalogs(catalogs));
    } catch {
      setError('No se pudieron cargar las piezas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [key]);

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBar title={label} />
        <Loading />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <AppBar title={label} />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBar
        title={label}
        rightAction={<Text style={styles.headerMeta}>{pieces.length} piezas</Text>}
      />

      <FlatList
        data={pieces}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={pieces.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin piezas"
            message="No hay piezas disponibles en esta categoría por ahora."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.status === 'active' && styles.cardActive]}
            onPress={() => router.push(`/item/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={[styles.imgBox, item.status === 'active' && styles.imgBoxLive]}>
              {item.photo ? (
                <Image source={{ uri: item.photo }} style={styles.img} />
              ) : (
                <Feather name="image" size={26} color={colors.text.tertiary} />
              )}
              {item.status === 'active' && (
                <View style={styles.livePill}>
                  <Text style={styles.livePillText}>● En vivo</Text>
                </View>
              )}
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.lotLabel}>Lote {item.lotNumber}</Text>
              <Text style={styles.itemDesc} numberOfLines={2}>
                {item.catalogDescription ?? 'Sin descripción'}
              </Text>
              {item.basePrice !== null && item.basePrice !== undefined ? (
                <Text style={styles.price}>Base ${item.basePrice.toLocaleString('es-AR')}</Text>
              ) : (
                <Text style={styles.priceMuted}>Iniciá sesión para ver</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  headerMeta: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },

  list: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center' },
  row: { gap: spacing.sm, marginBottom: spacing.sm },

  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  cardActive: { borderColor: colors.feedback.live, borderWidth: 2 },

  imgBox: {
    height: 88,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imgBoxLive: { backgroundColor: '#FEF2F2' },
  img: { width: '100%', height: '100%' },

  livePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: colors.feedback.live,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePillText: { fontSize: 9, color: '#fff', fontWeight: '700' },

  cardBody: { padding: spacing.sm },
  lotLabel: { ...typography.caption, color: colors.text.tertiary, marginBottom: 2 },
  itemDesc: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600', marginBottom: 4, lineHeight: 18 },
  price: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },
  priceMuted: { ...typography.caption, color: colors.text.tertiary, fontStyle: 'italic' },
});
