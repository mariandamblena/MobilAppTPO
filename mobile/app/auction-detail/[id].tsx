import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { AuctionDetail } from '@/api/types';

export default function AuctionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStreaming, setLoadingStreaming] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    get<AuctionDetail>(`/auctions/${id}`)
      .then(setAuction)
      .catch(() => setError('No se pudo cargar la subasta.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function openStreaming() {
    setLoadingStreaming(true);
    try {
      const { url } = await get<{ url: string }>(`/auctions/${id}/streaming`);
      await Linking.openURL(url);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'NOT_ADMITTED') {
        Alert.alert('Acceso restringido', 'Tu cuenta aún no fue admitida.');
      } else if (code === 'CATEGORY_INSUFFICIENT') {
        Alert.alert('Acceso restringido', 'Tu categoría no es suficiente para esta subasta.');
      } else {
        Alert.alert('Error', 'No hay URL de streaming disponible.');
      }
    } finally {
      setLoadingStreaming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta" />
        <Loading />
      </View>
    );
  }
  if (error || !auction) {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta" />
        <ErrorView message={error ?? 'Error al cargar'} onRetry={load} />
      </View>
    );
  }

  const isOpen = auction.status === 'open';
  const isScheduled = auction.status === 'scheduled';
  const canSeeStreaming = user?.admitted && auction.streamingUrl;

  return (
    <View style={styles.screen}>
      <AppBar title="Subasta" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Pills row */}
      <View style={styles.pillsRow}>
        {isOpen ? (
          <View style={styles.pillLive}>
            <Text style={styles.pillLiveText}>● En vivo</Text>
          </View>
        ) : isScheduled ? (
          <View style={styles.pillInfo}>
            <Text style={styles.pillInfoText}>Próxima</Text>
          </View>
        ) : (
          <View style={styles.pillOutline}>
            <Text style={styles.pillOutlineText}>Cerrada</Text>
          </View>
        )}
        <View style={styles.pillOutline}>
          <Text style={styles.pillOutlineText}>{auction.currency}</Text>
        </View>
        <View style={styles.pillHighlight}>
          <Text style={styles.pillHighlightText}>Cat. {auction.category.toUpperCase()}</Text>
        </View>
      </View>

      {/* Main info */}
      <View style={styles.mainInfo}>
        <Text style={styles.location}>{auction.location ?? 'Ubicación a confirmar'}</Text>
        <Text style={styles.date}>
          {new Date(auction.startsAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
        </Text>
        {auction.itemCount !== undefined && (
          <Text style={styles.meta}>{auction.itemCount} piezas · {auction.attendeeCount ?? 0} asistentes</Text>
        )}
      </View>

      {/* Details card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Detalles</Text>
        <DetailRow label="Moneda" value={auction.currency} />
        <DetailRow label="Ítems" value={String(auction.itemCount ?? '—')} />
        <DetailRow label="Asistentes" value={String(auction.attendeeCount ?? '—')} />
        {auction.attendeeCapacity != null && (
          <DetailRow label="Capacidad" value={String(auction.attendeeCapacity)} />
        )}
        {auction.isCollection && auction.collectionName && (
          <DetailRow label="Colección" value={auction.collectionName} />
        )}
        {auction.hasWarehouse && (
          <DetailRow label="Depósito" value="Disponible" />
        )}
      </View>

      {/* Scheduled notice */}
      {isScheduled && (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            Esta subasta comienza el{' '}
            {new Date(auction.startsAt).toLocaleDateString('es-AR', { dateStyle: 'long' })}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {auction.catalogId && (
          <Button
            title="Ver catálogo"
            onPress={() => router.push(`/auction-catalog/${id}`)}
          />
        )}
        {canSeeStreaming && (
          <Button
            title="Ver streaming"
            variant="outline"
            onPress={openStreaming}
            loading={loadingStreaming}
          />
        )}
        {isOpen && (
          <Button
            title="Conectarme en vivo"
            variant="outline"
            onPress={() => router.push(`/auction/${id}`)}
          />
        )}
      </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingBottom: 40 },

  pillsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    flexWrap: 'wrap',
  },
  pillLive: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.live,
  },
  pillLiveText: { fontSize: 12, color: '#fff', fontWeight: '700' },
  pillInfo: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.feedback.infoBackground,
    borderWidth: 1,
    borderColor: colors.feedback.info,
  },
  pillInfoText: { ...typography.caption, color: colors.feedback.info, fontWeight: '700' },
  pillOutline: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  pillOutlineText: { ...typography.caption, color: colors.text.secondary },
  pillHighlight: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primaryLight,
  },
  pillHighlightText: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },

  mainInfo: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  location: { ...typography.heading3, color: colors.text.primary, marginBottom: 4 },
  date: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 4 },
  meta: { ...typography.caption, color: colors.text.tertiary },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  cardLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.sm },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  detailLabel: { ...typography.bodySmall, color: colors.text.secondary },
  detailValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },

  noticeBanner: {
    backgroundColor: colors.feedback.infoBackground,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: { ...typography.bodySmall, color: colors.feedback.info },

  actions: { paddingHorizontal: spacing.md, gap: spacing.sm },
});
