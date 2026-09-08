import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { get, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { PayoutAccount } from '@/api/types';

export default function PayoutAccountsScreen() {
  const { ownerId } = useLocalSearchParams<{ ownerId: string }>();

  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [bank, setBank] = useState('');
  const [cbuOrIban, setCbuOrIban] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS');
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    get<PayoutAccount[]>(`/owners/${ownerId}/payout-accounts`)
      .then(setAccounts)
      .catch(() => setError('No se pudieron cargar las cuentas.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [ownerId]);

  async function addAccount() {
    if (!bank.trim() || !cbuOrIban.trim() || !accountHolder.trim()) {
      Alert.alert('Error', 'Todos los campos son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const newAccount = await post<PayoutAccount>(`/owners/${ownerId}/payout-accounts`, {
        bank: bank.trim(),
        cbuOrIban: cbuOrIban.trim(),
        accountHolder: accountHolder.trim(),
        currency,
      });
      setAccounts((prev) => [newAccount, ...prev]);
      setShowForm(false);
      setBank('');
      setCbuOrIban('');
      setAccountHolder('');
      Alert.alert('Listo', 'Cuenta declarada correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo declarar la cuenta.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <AppBar title="Cuentas de cobro" />
        <Loading />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.container}>
        <AppBar title="Cuentas de cobro" />
        <ErrorView message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppBar title="Cuentas de cobro" />

      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={accounts.length === 0 ? styles.emptyContainer : styles.list}
        ListHeaderComponent={
          <View>
            {/* Warning notice */}
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>
                ◉ Declará tu cuenta antes del inicio de la subasta para recibir el pago de la venta.
              </Text>
            </View>

            {/* Add account toggle */}
            {!showForm ? (
              <Button
                title="+ Agregar cuenta"
                onPress={() => setShowForm(true)}
                style={styles.addBtn}
              />
            ) : (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Nueva cuenta</Text>

                <Text style={styles.inputLabel}>Banco</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del banco"
                  placeholderTextColor={colors.text.tertiary}
                  value={bank}
                  onChangeText={setBank}
                />

                <Text style={styles.inputLabel}>CBU o IBAN</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Código de cuenta"
                  placeholderTextColor={colors.text.tertiary}
                  value={cbuOrIban}
                  onChangeText={setCbuOrIban}
                />

                <Text style={styles.inputLabel}>Titular</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nombre del titular"
                  placeholderTextColor={colors.text.tertiary}
                  value={accountHolder}
                  onChangeText={setAccountHolder}
                />

                <Text style={styles.inputLabel}>Moneda</Text>
                <View style={styles.currencyRow}>
                  <TouchableOpacity
                    style={[styles.currencyBtn, currency === 'ARS' && styles.currencyBtnActive]}
                    onPress={() => setCurrency('ARS')}
                  >
                    <Text style={[styles.currencyBtnText, currency === 'ARS' && styles.currencyBtnTextActive]}>
                      ARS
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.currencyBtn, currency === 'USD' && styles.currencyBtnActive]}
                    onPress={() => setCurrency('USD')}
                  >
                    <Text style={[styles.currencyBtnText, currency === 'USD' && styles.currencyBtnTextActive]}>
                      USD
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formActions}>
                  <Button
                    title="Cancelar"
                    variant="ghost"
                    onPress={() => setShowForm(false)}
                    style={styles.formBtn}
                  />
                  <Button
                    title="Guardar"
                    onPress={addAccount}
                    loading={saving}
                    style={styles.formBtn}
                  />
                </View>
              </View>
            )}

            {accounts.length > 0 && (
              <Text style={styles.sectionLabel}>Cuentas declaradas</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Sin cuentas declaradas"
            message="Declará una cuenta para recibir el pago de tus ventas."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardLeft}>
                <Text style={styles.bankName}>{item.bank}</Text>
                <Text style={styles.cbu}>{item.cbuOrIban}</Text>
                <Text style={styles.holder}>{item.accountHolder}</Text>
              </View>
              <View style={styles.currencyPill}>
                <Text style={styles.currencyPillText}>{item.currency}</Text>
              </View>
            </View>
            <Text style={styles.declaredAt}>
              Declarada el {new Date(item.declaredAt).toLocaleDateString('es-AR', { dateStyle: 'medium' })}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },

  list: { padding: spacing.md, paddingBottom: 40 },
  emptyContainer: { paddingHorizontal: spacing.md, paddingBottom: 40 },

  noticeBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.feedback.warning + '50',
    borderStyle: 'dashed',
  },
  noticeText: { ...typography.bodySmall, color: colors.feedback.warning },

  addBtn: { marginBottom: spacing.md },

  form: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.md,
  },
  formTitle: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.sm },
  inputLabel: { ...typography.caption, color: colors.text.secondary, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  currencyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  currencyBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
  },
  currencyBtnActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  currencyBtnText: { ...typography.label, color: colors.text.secondary },
  currencyBtnTextActive: { color: '#fff' },
  formActions: { flexDirection: 'row', gap: spacing.sm },
  formBtn: { flex: 1 },

  sectionLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: spacing.sm },

  card: {
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  cardLeft: { flex: 1 },
  bankName: { ...typography.body, color: colors.text.primary, fontWeight: '700', marginBottom: 2 },
  cbu: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: 2 },
  holder: { ...typography.bodySmall, color: colors.text.secondary },
  currencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primaryLight,
  },
  currencyPillText: { ...typography.caption, color: colors.brand.primary, fontWeight: '700' },
  declaredAt: { ...typography.caption, color: colors.text.tertiary, marginTop: 4 },
});
