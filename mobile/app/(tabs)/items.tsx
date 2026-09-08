import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { get } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { colors, typography, spacing, radius } from '@/theme';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/inclusionMeta';
import type { InclusionRequest } from '@/api/types';
import type { ApiError } from '@/api/client';

const IN_PROGRESS = ['pending', 'under_inspection', 'proposal_sent'];

type InclusionRequestWithProduct = InclusionRequest & {
  product?: {
    catalogDescription?: string | null;
    photos?: Array<{ photoUrl: string }>;
  };
};

export default function VenderScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<InclusionRequestWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await get<InclusionRequestWithProduct[]>('/inclusion-requests');
      setRequests(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar tus piezas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchRequests(); }, [fetchRequests]));

  const renderItem = useCallback(({ item }: { item: InclusionRequestWithProduct }) => {
    const statusColor = STATUS_COLORS[item.status] ?? colors.text.secondary;
    const thumb = item.product?.photos?.[0]?.photoUrl;
    const label = item.product?.catalogDescription ?? item.itemDescription;
    const hasProposal = item.status === 'proposal_sent';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/items/${item.id}`)}
        activeOpacity={0.7}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbText}>Sin foto</Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{label}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {STATUS_LABELS[item.status] ?? item.status}
            </Text>
          </View>
          {hasProposal && <Text style={styles.proposalCta}>Ver propuesta →</Text>}
        </View>

        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
      </TouchableOpacity>
    );
  }, [router]);

  const enCurso = requests.filter((r) => IN_PROGRESS.includes(r.status)).length;
  const aceptadas = requests.filter((r) => r.status === 'accepted').length;

  return (
    <View style={styles.screen}>
      <AppBar />

      {loading ? (
        <Loading />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchRequests}>
            <Text style={styles.retryLink}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={requests.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={
            <View>
              <Text style={styles.screenTitle}>Vender</Text>
              <View style={styles.statsRow}>
                <StatCard variant="pill" value={enCurso} label="En curso" />
                <StatCard variant="pill" value={aceptadas} label="Aceptadas" />
                <StatCard variant="pill" value={requests.length} label="Total" />
              </View>
              {requests.length > 0 && <Text style={styles.sectionLabel}>MIS PIEZAS</Text>}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="Aún no tenés piezas"
              message="Proponé tu primera pieza para incluirla en una subasta."
            />
          }
        />
      )}

      <View style={styles.ctaBar}>
        <Button title="+ Proponer nueva pieza" onPress={() => router.push('/items/new')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  errorText: { ...typography.body, color: colors.feedback.error, textAlign: 'center', marginBottom: spacing.sm },
  retryLink: { ...typography.bodySmall, color: colors.brand.primary },

  list: { padding: spacing.md, paddingBottom: 100 },
  emptyContainer: { flexGrow: 1, padding: spacing.md, paddingBottom: 100 },

  screenTitle: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  sectionLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.sm },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  thumb: { width: 72, height: 72 },
  thumbPlaceholder: { backgroundColor: colors.background.secondary, alignItems: 'center', justifyContent: 'center' },
  thumbText: { ...typography.caption, color: colors.text.tertiary },
  cardBody: { flex: 1, padding: spacing.sm, gap: 4 },
  cardTitle: { ...typography.label, color: colors.text.primary },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  proposalCta: { ...typography.caption, color: colors.brand.primary, fontWeight: '600' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.md },

  ctaBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.md,
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
});
