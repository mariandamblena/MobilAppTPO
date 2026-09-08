import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { get, patch, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { SaleRecord, PaymentMethod } from '@/api/types';
import type { ApiError } from '@/api/client';

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [purchase, setPurchase] = useState<SaleRecord | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickupInPerson, setPickupInPerson] = useState<boolean | null>(null);
  const [shippingAddress, setShippingAddress] = useState('');
  const [savingShipping, setSavingShipping] = useState(false);

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([
      get<SaleRecord>(`/sale-records/${id}`).catch(() => null),
      get<PaymentMethod[]>('/me/payment-methods').catch(() => []),
    ]).then(([saleRecord, methods]) => {
      if (saleRecord) {
        setPurchase(saleRecord);
        setPickupInPerson(saleRecord.pickupInPerson);
        setShippingAddress(saleRecord.shippingAddress ?? '');
      } else {
        setError('No se encontró la compra.');
      }
      const verified = (methods as PaymentMethod[]).filter((m) => m.status === 'verified');
      setPaymentMethods(verified);
    }).finally(() => setLoading(false));
  }, [id]);

  async function saveShipping() {
    if (pickupInPerson === null) return;
    if (!pickupInPerson && !shippingAddress.trim()) {
      Alert.alert('Error', 'Ingresá una dirección de envío.');
      return;
    }
    if (pickupInPerson) {
      Alert.alert(
        'Confirmar retiro',
        'Si retirás en persona, perdés la cobertura del seguro del bien. ¿Confirmás?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Confirmar', onPress: doSaveShipping },
        ]
      );
    } else {
      await doSaveShipping();
    }
  }

  async function doSaveShipping() {
    setSavingShipping(true);
    try {
      const updated = await patch<SaleRecord>(`/sale-records/${id}/shipping`, {
        pickupInPerson,
        shippingAddress: pickupInPerson ? undefined : shippingAddress,
      });
      setPurchase(updated);
      Alert.alert('Listo', 'Modalidad de entrega guardada.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo guardar.');
    } finally {
      setSavingShipping(false);
    }
  }

  async function pay() {
    if (!selectedPaymentMethodId) {
      Alert.alert('Error', 'Seleccioná un medio de pago.');
      return;
    }
    setPaying(true);
    try {
      const updated = await post<SaleRecord>(`/sale-records/${id}/pay`, {
        paymentMethodId: selectedPaymentMethodId,
      });
      setPurchase(updated);
      Alert.alert('¡Pago exitoso!', 'Tu pago fue procesado correctamente.');
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.code === 'INSUFFICIENT_FUNDS') {
        const details = apiError.details as { penaltyAmount?: number } | undefined;
        Alert.alert(
          'Pago fallido',
          `No se pudo procesar el pago. Se generó una multa del 10% ($${details?.penaltyAmount?.toFixed(2) ?? '?'}). Tenés 72 hs para regularizar.`,
          [{ text: 'OK' }]
        );
      } else if (apiError.code === 'NO_VERIFIED_PAYMENT_METHOD') {
        Alert.alert('Error', 'El medio de pago no está verificado.');
      } else if (apiError.code === 'PAYMENT_METHOD_NOT_OWNED') {
        Alert.alert('Error', 'Ese medio de pago no te pertenece.');
      } else {
        Alert.alert('Error', apiError.message ?? 'No se pudo procesar el pago.');
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.screen}>
        <AppBar title="Compra" />
        <Loading />
      </View>
    );
  }
  if (error || !purchase) {
    return (
      <View style={styles.screen}>
        <AppBar title="Compra" />
        <ErrorView message={error ?? 'Error'} onRetry={() => router.back()} />
      </View>
    );
  }

  const total = purchase.amount + purchase.commission + (purchase.shippingCost ?? 0);
  const isPending = purchase.paymentStatus === 'pending';
  const isPaid = purchase.paymentStatus === 'paid';
  const isFailed = purchase.paymentStatus === 'failed';

  return (
    <View style={styles.screen}>
      <AppBar title={`Factura #${purchase.id}`} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.statusBanner, isPaid ? styles.bannerPaid : isFailed ? styles.bannerFailed : styles.bannerPending]}>
        <Text style={styles.statusText}>
          {isPaid ? 'Pagado' : isFailed ? 'Pago fallido' : 'Pendiente de pago'}
        </Text>
      </View>

      {purchase.product?.catalogDescription && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Pieza</Text>
          <Text style={styles.piezaTitle}>{purchase.product.catalogDescription}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Desglose</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Oferta ganadora</Text>
          <Text style={styles.rowValue}>${purchase.amount.toLocaleString('es-AR')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Comisión</Text>
          <Text style={styles.rowValue}>${purchase.commission.toLocaleString('es-AR')}</Text>
        </View>
        {purchase.shippingCost != null && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Seguro + envío</Text>
            <Text style={styles.rowValue}>${purchase.shippingCost.toLocaleString('es-AR')}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a pagar</Text>
          <Text style={styles.totalValue}>${total.toLocaleString('es-AR')}</Text>
        </View>
      </View>

      {isPending && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Modalidad de entrega</Text>

          <TouchableOpacity
            style={[styles.optionRow, pickupInPerson === false && styles.optionRowSelected]}
            onPress={() => setPickupInPerson(false)}
          >
            <View style={[styles.optionRadio, pickupInPerson === false && styles.optionRadioSelected]} />
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Envío al domicilio</Text>
              <Text style={styles.optionSub}>Con seguro incluido</Text>
            </View>
          </TouchableOpacity>

          {pickupInPerson === false && (
            <TextInput
              style={styles.input}
              placeholder="Dirección de envío"
              placeholderTextColor={colors.text.tertiary}
              value={shippingAddress}
              onChangeText={setShippingAddress}
            />
          )}

          <TouchableOpacity
            style={[styles.optionRow, pickupInPerson === true && styles.optionRowSelected]}
            onPress={() => setPickupInPerson(true)}
          >
            <View style={[styles.optionRadio, pickupInPerson === true && styles.optionRadioSelected]} />
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Retiro en depósito</Text>
              <Text style={[styles.optionSub, styles.optionSubWarning]}>
                Pierde cobertura del seguro al retirar
              </Text>
            </View>
          </TouchableOpacity>

          <Button
            title="Confirmar modalidad"
            variant="outline"
            onPress={saveShipping}
            loading={savingShipping}
            style={styles.confirmBtn}
          />
        </View>
      )}

      {isPending && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Medio de pago</Text>

          {paymentMethods.length === 0 ? (
            <Text style={styles.noMethodText}>
              No tenés medios de pago verificados. Agregá uno desde tu perfil.
            </Text>
          ) : (
            <>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[styles.methodRow, selectedPaymentMethodId === method.id && styles.methodRowSelected]}
                  onPress={() => setSelectedPaymentMethodId(method.id)}
                >
                  <Text style={styles.methodIcon}>
                    {method.type === 'bank_account' ? '🏦' : method.type === 'credit_card' ? '💳' : '📄'}
                  </Text>
                  <Text style={styles.methodDetail}>{method.detail}</Text>
                  <Text style={styles.methodCurrency}>{method.currency}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}

      {/* Pay button */}
      {isPending && paymentMethods.length > 0 && (
        <View style={styles.payRow}>
          <View style={styles.divider} />
          <View style={styles.finalTotal}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toLocaleString('es-AR')}</Text>
          </View>
          <Button title="Pagar" onPress={pay} loading={paying} />
        </View>
      )}

      {isPaid && purchase.paidAt && (
        <Text style={styles.paidAt}>
          Pagado el {new Date(purchase.paidAt).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { paddingBottom: 40 },

  statusBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  bannerPaid: { backgroundColor: colors.feedback.successBackground },
  bannerFailed: { backgroundColor: colors.feedback.errorBackground },
  bannerPending: { backgroundColor: colors.feedback.warningBackground },
  statusText: { ...typography.label, fontWeight: '700', color: colors.text.primary },

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

  piezaTitle: { ...typography.body, color: colors.text.primary, fontWeight: '600' },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowLabel: { ...typography.bodySmall, color: colors.text.secondary },
  rowValue: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: colors.border.default, marginVertical: spacing.sm },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...typography.body, color: colors.text.primary, fontWeight: '700' },
  totalValue: { ...typography.heading3, color: colors.brand.primary, fontWeight: '800' },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.sm,
  },
  optionRowSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border.strong,
    marginTop: 2,
  },
  optionRadioSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  optionBody: { flex: 1 },
  optionTitle: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  optionSub: { ...typography.caption, color: colors.text.secondary, marginTop: 2 },
  optionSubWarning: { color: colors.brand.accent },

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
  confirmBtn: { marginTop: spacing.xs },

  noMethodText: { ...typography.bodySmall, color: colors.text.tertiary, fontStyle: 'italic' },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.strong,
    marginBottom: spacing.xs,
  },
  methodRowSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
  },
  methodIcon: { fontSize: 20 },
  methodDetail: { flex: 1, ...typography.bodySmall, color: colors.text.primary },
  methodCurrency: { ...typography.caption, color: colors.text.tertiary },

  payRow: {
    padding: spacing.md,
  },
  finalTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  paidAt: { ...typography.caption, color: colors.text.tertiary, textAlign: 'center', padding: spacing.md },
});
