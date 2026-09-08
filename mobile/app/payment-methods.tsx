/**
 * Pantalla de medios de pago — F02 Medios de pago
 * TODO
 *
 * Estados de la pantalla:
 *   loading  → muestra <Loading>
 *   error    → muestra <ErrorView> con botón Reintentar
 *   empty    → muestra <EmptyState> con CTA "Agregar medio de pago"
 *   success  → lista de medios con badge de estado y acciones
 *
 * Acciones disponibles:
 *   - Agregar medio de pago (formulario inline inferior)
 *   - Eliminar un medio propio (confirmación via Alert)
 *
 * Accesible desde el perfil via router.push('/payment-methods').
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { get, post, del, ApiError } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { Field } from '@/components/Field';
import { Loading } from '@/components/Loading';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, spacing, typography } from '@/theme';

// ─────────────── Tipos ───────────────

/** Tipo de medio de pago según el modelo Prisma. */
type PaymentMethodType = 'bank_account' | 'credit_card' | 'certified_check';

/** Estado de verificación del medio. */
type PaymentStatus = 'pending' | 'verified' | 'rejected';

/** Moneda admitida. */
type Currency = 'ARS' | 'USD';

/** Modelo PaymentMethod tal como lo devuelve el backend. */
interface PaymentMethod {
  id: number;
  clientId: number;
  type: PaymentMethodType;
  currency: Currency;
  detail: string;
  bank: string | null;
  countryId: number | null;
  reservedAmount: number | null;
  status: PaymentStatus;
  rejectionReason: string | null;
  createdAt: string;
}

/** Errores del formulario por campo. */
interface FormErrors {
  type?: string;
  currency?: string;
  detail?: string;
  bank?: string;
  reservedAmount?: string;
}

// ─────────────── Constantes de UI ───────────────

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  bank_account: 'Cuenta bancaria',
  credit_card: 'Tarjeta de crédito',
  certified_check: 'Cheque certificado',
};

const TYPE_ICONS: Record<PaymentMethodType, keyof typeof Feather.glyphMap> = {
  bank_account: 'briefcase',
  credit_card: 'credit-card',
  certified_check: 'file-text',
};

const STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendiente',
  verified: 'Verificado',
  rejected: 'Rechazado',
};

/** Colores del badge de estado según la especificación de diseño F02. */
const STATUS_COLORS: Record<PaymentStatus, { bg: string; text: string }> = {
  pending: { bg: colors.feedback.warningBackground, text: colors.feedback.warning },
  verified: { bg: colors.feedback.successBackground, text: colors.feedback.success },
  rejected: { bg: colors.feedback.errorBackground, text: colors.feedback.error },
};

const CURRENCIES: Currency[] = ['ARS', 'USD'];

const PAYMENT_TYPES: PaymentMethodType[] = [
  'bank_account',
  'credit_card',
  'certified_check',
];

// ─────────────── Componente badge de estado ───────────────

/** Badge visual de estado: pending (amarillo) / verified (verde) / rejected (rojo). */
function StatusBadge({ status }: { status: PaymentStatus }) {
  const palette = STATUS_COLORS[status];
  const icon = status === 'verified' ? 'check-circle' : status === 'pending' ? 'clock' : 'x-circle';
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Feather name={icon} size={12} color={palette.text} />
      <Text style={[styles.badgeText, { color: palette.text }]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// ─────────────── Componente tarjeta de medio ───────────────

interface PaymentCardProps {
  method: PaymentMethod;
  onDelete: (id: number) => void;
}

/**
 * Tarjeta de un medio de pago con información, badge de estado y acciones.
 */
function PaymentCard({ method, onDelete }: PaymentCardProps) {
  const handleDelete = () => {
    // Confirmación antes de borrar — ver F02 §Baja de medio de pago
    Alert.alert(
      'Eliminar medio de pago',
      `¿Confirmás que querés eliminar este ${TYPE_LABELS[method.type]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(method.id),
        },
      ]
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardMain}>
        <View style={styles.iconBox}>
          <Feather name={TYPE_ICONS[method.type]} size={20} color={colors.brand.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {method.bank ?? TYPE_LABELS[method.type]}
          </Text>
          <Text style={styles.cardDetail} numberOfLines={1}>{method.detail}</Text>
          {method.reservedAmount != null ? (
            <Text style={styles.cardMeta}>
              Reservado: {method.currency} {method.reservedAmount.toLocaleString('es-AR')}
            </Text>
          ) : null}
        </View>
        <StatusBadge status={method.status} />
      </View>

      {/* Motivo de rechazo si corresponde */}
      {method.status === 'rejected' && method.rejectionReason ? (
        <View style={styles.rejectionBox}>
          <Text style={styles.rejectionText}>Motivo: {method.rejectionReason}</Text>
        </View>
      ) : null}

      {/* Acciones */}
      <View style={styles.cardActions}>
        <Button title="Eliminar" variant="ghost" onPress={handleDelete} style={styles.deleteBtn} />
      </View>
    </View>
  );
}

// ─────────────── Pantalla principal ───────────────

/**
 * Pantalla /payment-methods
 * Lista los medios de pago del cliente autenticado y permite agregar o eliminar.
 */
export default function PaymentMethodsScreen() {
  // Estado de la lista
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Estado del formulario de alta
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<PaymentMethodType>('bank_account');
  const [formCurrency, setFormCurrency] = useState<Currency>('ARS');
  const [formDetail, setFormDetail] = useState('');
  const [formBank, setFormBank] = useState('');
  const [formReservedAmount, setFormReservedAmount] = useState('');
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Carga la lista de medios ──

  const loadMethods = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const data = await get<PaymentMethod[]>('/me/payment-methods');
      setMethods(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los medios de pago. Reintentá.';
      setListError(message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  // ── Eliminar medio ──

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await del(`/payment-methods/${id}`);
        // Actualización inmutable: devuelve nueva lista sin el elemento eliminado
        setMethods((prev) => prev.filter((m) => m.id !== id));
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'No se pudo eliminar el medio de pago.';
        Alert.alert('Error', message);
      }
    },
    []
  );

  // ── Validación local del formulario ──

  function validateForm(): boolean {
    const errors: FormErrors = {};

    if (!formDetail.trim()) {
      errors.detail = 'El detalle es obligatorio';
    }

    if (formType === 'certified_check') {
      const amount = parseFloat(formReservedAmount);
      if (!formReservedAmount.trim() || isNaN(amount) || amount <= 0) {
        errors.reservedAmount = 'El monto reservado debe ser mayor a 0';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Envío del formulario de alta ──

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        type: formType,
        currency: formCurrency,
        detail: formDetail.trim(),
      };

      if (formBank.trim()) {
        body.bank = formBank.trim();
      }

      if (formType === 'certified_check') {
        body.reservedAmount = parseFloat(formReservedAmount);
      }

      const created = await post<PaymentMethod>('/me/payment-methods', body);

      // Actualización inmutable: agrega el nuevo medio al inicio de la lista
      setMethods((prev) => [created, ...prev]);

      // Resetear formulario
      setShowForm(false);
      setFormDetail('');
      setFormBank('');
      setFormReservedAmount('');
      setFormType('bank_account');
      setFormCurrency('ARS');
      setFormErrors({});

      Alert.alert('Listo', 'Medio registrado. Queda pendiente de verificación.');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        // Mapear errores de campo del backend al estado del formulario
        const fields = (err.details?.fields ?? {}) as Record<string, string>;
        setFormErrors(fields);
      } else {
        const message =
          err instanceof ApiError ? err.message : 'No se pudo registrar el medio.';
        Alert.alert('Error', message);
      }
    } finally {
      setSubmitting(false);
    }
  }, [formType, formCurrency, formDetail, formBank, formReservedAmount]);

  // ─────────────── Render ───────────────

  if (loadingList) {
    return (
      <View style={styles.screenWrap}>
        <AppBar title="Medios de pago" />
        <Loading message="Cargando medios de pago..." />
      </View>
    );
  }

  if (listError) {
    return (
      <View style={styles.screenWrap}>
        <AppBar title="Medios de pago" />
        <ErrorView message={listError} onRetry={loadMethods} />
      </View>
    );
  }

  const hasVerified = methods.some((m) => m.status === 'verified');

  return (
    <ScreenContainer header={<AppBar title="Medios de pago" />}>
        <Text style={styles.subtitle}>
          Gestioná de forma segura los métodos de pago que vas a usar.
        </Text>

        {/* Banner de aviso si no hay medio verificado */}
        {!hasVerified && methods.length > 0 ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Necesitás al menos un medio verificado para pujar.
            </Text>
          </View>
        ) : null}

        {/* Estado vacío */}
        {methods.length === 0 && !showForm ? (
          <EmptyState
            title="Sin medios de pago"
            message="Registrá tu primer medio de pago para poder participar en subastas."
            actionLabel="Agregar medio de pago"
            onAction={() => setShowForm(true)}
          />
        ) : null}

        {/* Lista de medios */}
        {methods.map((method) => (
          <PaymentCard
            key={method.id}
            method={method}
            onDelete={handleDelete}
          />
        ))}

        {/* Botón para mostrar el formulario (cuando ya hay medios) */}
        {methods.length > 0 && !showForm ? (
          <Button
            title="+ Agregar nuevo método"
            onPress={() => setShowForm(true)}
            style={styles.addBtn}
          />
        ) : null}

        {/* ── Formulario de alta ── */}
        {showForm ? (
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Nuevo medio de pago</Text>

            {/* Selector de tipo */}
            <Text style={styles.selectorLabel}>
              Tipo <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.selectorRow}>
              {PAYMENT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.selectorOption,
                    formType === t && styles.selectorOptionActive,
                  ]}
                  onPress={() => {
                    setFormType(t);
                    // Limpiar campos condicionales al cambiar de tipo
                    setFormReservedAmount('');
                    setFormErrors({});
                  }}
                >
                  <Text
                    style={[
                      styles.selectorOptionText,
                      formType === t && styles.selectorOptionTextActive,
                    ]}
                  >
                    {TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Selector de moneda */}
            <Text style={styles.selectorLabel}>
              Moneda <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.selectorRow, styles.selectorRowSmall]}>
              {CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.selectorOption,
                    formCurrency === c && styles.selectorOptionActive,
                  ]}
                  onPress={() => setFormCurrency(c)}
                >
                  <Text
                    style={[
                      styles.selectorOptionText,
                      formCurrency === c && styles.selectorOptionTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Campo detail — obligatorio para todos */}
            <Field
              label={
                formType === 'bank_account'
                  ? 'CBU / IBAN'
                  : formType === 'credit_card'
                  ? 'Últimos 4 dígitos / alias'
                  : 'Referencia del cheque'
              }
              required
              value={formDetail}
              onChangeText={setFormDetail}
              error={formErrors.detail}
              placeholder="Ej: 0000003100012345678901"
              autoCapitalize="none"
            />

            {/* Campo banco — solo cuenta bancaria */}
            {formType === 'bank_account' ? (
              <Field
                label="Banco"
                value={formBank}
                onChangeText={setFormBank}
                error={formErrors.bank}
                placeholder="Ej: Banco Nación"
                autoCapitalize="words"
              />
            ) : null}

            {/* Campo monto reservado — solo cheque certificado */}
            {formType === 'certified_check' ? (
              <Field
                label="Monto reservado"
                required
                value={formReservedAmount}
                onChangeText={setFormReservedAmount}
                error={formErrors.reservedAmount}
                placeholder="Ej: 50000"
                keyboardType="numeric"
              />
            ) : null}

            {/* Acciones del formulario */}
            <View style={styles.formActions}>
              <Button
                title="Guardar"
                loading={submitting}
                onPress={handleSubmit}
                style={styles.saveBtn}
              />
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => {
                  setShowForm(false);
                  setFormErrors({});
                }}
                disabled={submitting}
              />
            </View>
          </View>
        ) : null}
    </ScreenContainer>
  );
}

// ─────────────── Estilos ───────────────

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: colors.background.primary },

  // Banner de aviso sin medio verificado
  warningBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.warning,
  },
  warningText: {
    ...typography.body,
    color: colors.feedback.warning,
  },

  subtitle: { ...typography.bodySmall, color: colors.text.secondary, marginBottom: spacing.md },

  // Tarjeta de medio de pago
  card: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.brand.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: {
    ...typography.label,
    color: colors.text.primary,
  },
  cardDetail: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  deleteBtn: {
    minHeight: 0,
    paddingVertical: spacing.xs,
  },

  // Badge de estado
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },

  // Caja de motivo de rechazo
  rejectionBox: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 6,
    padding: spacing.xs,
    marginTop: spacing.xs,
  },
  rejectionText: {
    ...typography.caption,
    color: colors.feedback.error,
  },

  // Botón agregar
  addBtn: {
    marginTop: spacing.md,
  },

  // Formulario de alta
  formContainer: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.strong,
  },
  formTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  formActions: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  saveBtn: {
    marginBottom: spacing.xs,
  },

  // Selectores de tipo y moneda
  selectorLabel: {
    ...typography.label,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.feedback.error,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  selectorRowSmall: {
    flexDirection: 'row',
  },
  selectorOption: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  selectorOptionActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
  },
  selectorOptionText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  selectorOptionTextActive: {
    color: colors.brand.primary,
    fontWeight: '600',
  },
});
