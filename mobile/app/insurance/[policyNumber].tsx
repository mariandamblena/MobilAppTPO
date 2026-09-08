import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { get, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { Insurance } from '@/api/types';

export default function InsuranceScreen() {
  const { policyNumber } = useLocalSearchParams<{ policyNumber: string }>();

  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCoverageForm, setShowCoverageForm] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [increasing, setIncreasing] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    get<Insurance>(`/insurance/${policyNumber}`)
      .then(setInsurance)
      .catch(() => setError('No se pudo cargar la póliza.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [policyNumber]);

  async function increaseCoverage() {
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) {
      setAmountError('Ingresá un monto válido.');
      return;
    }
    if (insurance && amount <= insurance.amount) {
      setAmountError(`Debe ser mayor al monto actual ($${insurance.amount.toLocaleString('es-AR')}).`);
      return;
    }

    setAmountError(null);
    setIncreasing(true);
    try {
      const result = await post<{
        policyNumber: string;
        previousAmount: number;
        newAmount: number;
        premiumDelta: number;
        status: string;
      }>(`/insurance/${policyNumber}/coverage-increase`, { newAmount: amount });

      Alert.alert(
        'Cobertura actualizada',
        `Nueva cobertura: $${result.newAmount.toLocaleString('es-AR')}.\nPremio adicional: $${result.premiumDelta.toFixed(2)}.`
      );
      setInsurance((prev) => prev ? { ...prev, amount: result.newAmount } : null);
      setNewAmount('');
      setShowCoverageForm(false);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo aumentar la cobertura.');
    } finally {
      setIncreasing(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppBar title="Custodia de mi pieza" />
        <Loading />
      </View>
    );
  }
  if (error || !insurance) {
    return (
      <View style={styles.screen}>
        <AppBar title="Custodia de mi pieza" />
        <ErrorView message={error ?? 'Error'} onRetry={load} />
      </View>
    );
  }

  const estimatedDelta = newAmount && parseFloat(newAmount) > insurance.amount
    ? ((parseFloat(newAmount) - insurance.amount) * 0.02).toFixed(2)
    : null;

  return (
    <View style={styles.screen}>
      <AppBar title="Custodia de mi pieza" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>Depósito</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Ubicación</Text>
        <Text style={styles.locationName}>Depósito Auctify</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Póliza de seguro</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>N°</Text>
          <Text style={styles.rowValue}>{insurance.policyNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Asegurado por</Text>
          <Text style={styles.rowValue}>${insurance.amount.toLocaleString('es-AR')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Compañía</Text>
          <Text style={styles.rowValue}>{insurance.company}</Text>
        </View>

        {insurance.combinedPolicy && (
          <View style={styles.combinedBadge}>
            <Text style={styles.combinedText}>Póliza combinada · cubre varios bienes del mismo dueño</Text>
          </View>
        )}
      </View>

      {!showCoverageForm ? (
        <View style={styles.actionRow}>
          <Button
            title="Ampliar cobertura"
            variant="outline"
            onPress={() => setShowCoverageForm(true)}
          />
          <Button
            title="Descargar póliza"
            variant="ghost"
            onPress={() => Alert.alert('Póliza', 'La descarga estará disponible próximamente.')}
          />
        </View>
      ) : (
        <View style={styles.cardDashed}>
          <Text style={styles.cardLabel}>Ampliar cobertura</Text>
          <Text style={styles.coverageHint}>
            Cobertura actual: ${insurance.amount.toLocaleString('es-AR')}
          </Text>

          <TextInput
            style={[styles.input, amountError ? styles.inputError : null]}
            placeholder="Nuevo monto de cobertura"
            placeholderTextColor={colors.text.tertiary}
            value={newAmount}
            onChangeText={(t) => { setNewAmount(t); setAmountError(null); }}
            keyboardType="decimal-pad"
          />

          {amountError && <Text style={styles.errorText}>{amountError}</Text>}

          {estimatedDelta && (
            <View style={styles.deltaBanner}>
              <Text style={styles.deltaText}>Premio estimado: ${estimatedDelta}</Text>
            </View>
          )}

          <View style={styles.formActions}>
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => { setShowCoverageForm(false); setNewAmount(''); setAmountError(null); }}
              style={styles.formBtn}
            />
            <Button
              title="Confirmar"
              onPress={increaseCoverage}
              loading={increasing}
              style={styles.formBtn}
            />
          </View>
        </View>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingBottom: 40 },

  mapPlaceholder: {
    height: 110,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  mapText: { ...typography.bodySmall, color: colors.text.tertiary },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    margin: spacing.md,
    marginBottom: 0,
  },
  cardLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.sm },

  locationName: { ...typography.body, color: colors.text.primary, fontWeight: '700' },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowLabel: { ...typography.bodySmall, color: colors.text.secondary },
  rowValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },

  combinedBadge: {
    backgroundColor: colors.brand.primaryLight,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  combinedText: { ...typography.bodySmall, color: colors.brand.primary },

  actionRow: {
    padding: spacing.md,
    paddingBottom: 0,
    gap: spacing.sm,
  },

  cardDashed: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderStyle: 'dashed',
    margin: spacing.md,
    marginBottom: 0,
  },
  coverageHint: { ...typography.bodySmall, color: colors.text.tertiary, marginBottom: spacing.sm },

  input: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  inputError: { borderColor: colors.border.error },
  errorText: { ...typography.caption, color: colors.feedback.error, marginBottom: spacing.xs },

  deltaBanner: {
    backgroundColor: colors.feedback.successBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  deltaText: { ...typography.bodySmall, color: colors.feedback.success, fontWeight: '600' },

  formActions: { flexDirection: 'row', gap: spacing.sm },
  formBtn: { flex: 1 },
});
