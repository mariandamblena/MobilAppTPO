import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { Button } from '@/components/Button';
import { colors, typography, spacing } from '@/theme';
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/inclusionMeta';
import type { InclusionRequest } from '@/api/types';
import type { ApiError } from '@/api/client';

export default function InclusionRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [request, setRequest] = useState<InclusionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    try {
      const data = await get<InclusionRequest>(`/inclusion-requests/${id}`);
      setRequest(data);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudo cargar la solicitud.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  async function respond(accepted: boolean) {
    const action = accepted ? 'aceptar' : 'rechazar';
    Alert.alert(
      accepted ? 'Aceptar propuesta' : 'Rechazar propuesta',
      `¿Confirmás que querés ${action} la propuesta?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: accepted ? 'default' : 'destructive',
          onPress: async () => {
            setResponding(true);
            try {
              const updated = await post<InclusionRequest>(
                `/inclusion-requests/${id}/owner-response`,
                { accepted }
              );
              setRequest(updated);
            } catch (err) {
              Alert.alert('Error', (err as ApiError).message ?? 'No se pudo registrar tu respuesta.');
            } finally {
              setResponding(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppBar title="Solicitud" />
        <Loading />
      </View>
    );
  }

  if (error || !request) {
    return (
      <View style={styles.screen}>
        <AppBar title="Solicitud" />
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error ?? 'Solicitud no encontrada'}</Text>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[request.status] ?? colors.text.secondary;

  return (
    <View style={styles.screen}>
      <AppBar title={`Solicitud #${request.id}`} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>
          {STATUS_LABELS[request.status] ?? request.status}
        </Text>
      </View>

      <Text style={styles.description}>{request.itemDescription}</Text>

      {/* Rechazo de inspección */}
      {request.status === 'rejected' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Motivo de rechazo</Text>
          <Text style={styles.sectionBody}>{request.rejectionReason}</Text>
          {request.returnShippingCost != null && (
            <Text style={styles.shippingCost}>
              Costo de devolución con cargo: ${request.returnShippingCost.toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {/* Propuesta enviada */}
      {request.status === 'proposal_sent' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Propuesta de la empresa</Text>
          {request.proposedBasePrice != null && (
            <Text style={styles.sectionBody}>
              Precio base: <Text style={styles.bold}>${request.proposedBasePrice.toLocaleString()}</Text>
            </Text>
          )}
          {request.proposedCommission != null && (
            <Text style={styles.sectionBody}>
              Comisión: <Text style={styles.bold}>${request.proposedCommission.toLocaleString()}</Text>
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              title="Aceptar propuesta"
              onPress={() => respond(true)}
              loading={responding}
              style={styles.acceptBtn}
            />
            <Button
              title="Rechazar propuesta"
              variant="outline"
              onPress={() => respond(false)}
              loading={responding}
              style={styles.rejectBtn}
            />
          </View>
        </View>
      )}

      {/* Propuesta rechazada */}
      {request.status === 'proposal_rejected' && request.returnShippingCost != null && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Devolución con cargo</Text>
          <Text style={styles.shippingCost}>
            Costo de devolución: ${request.returnShippingCost.toLocaleString()}
          </Text>
        </View>
      )}

      <Text style={styles.date}>
        Creada el {new Date(request.createdAt).toLocaleDateString('es-AR')}
      </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  badgeText: { ...typography.bodySmall, fontWeight: '600' },
  description: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  section: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.label, color: colors.text.primary, marginBottom: spacing.sm },
  sectionBody: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.xs },
  bold: { fontWeight: '700', color: colors.text.primary },
  shippingCost: { ...typography.body, color: colors.feedback.error, fontWeight: '600', marginTop: spacing.xs },
  actions: { marginTop: spacing.md, gap: spacing.sm },
  acceptBtn: {},
  rejectBtn: { marginTop: spacing.xs },
  date: { ...typography.caption, color: colors.text.tertiary, marginTop: spacing.lg },
  errorText: { ...typography.body, color: colors.feedback.error, textAlign: 'center', marginBottom: spacing.md },
});
