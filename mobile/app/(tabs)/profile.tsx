import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/auth/AuthContext';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { StatCard } from '@/components/StatCard';
import { get } from '@/api/client';
import { colors, typography, spacing, radius } from '@/theme';
import { CATEGORY_LABELS } from '@/lib/categoryMeta';
import type { Metrics } from '@/api/types';

/**
 * Perfil del cliente (F01 / F02 / F08).
 * Avatar + nombre + 3 stat pills (de /me/metrics) + menú con iconos + logout.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, logout, refreshMe } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
      get<Metrics>('/me/metrics')
        .then(setMetrics)
        .catch(() => setMetrics(null));
    }, [refreshMe])
  );

  if (loading) return <Loading />;
  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  const initial = user.name?.charAt(0).toUpperCase() ?? 'U';

  return (
    <View style={styles.container}>
      <AppBar />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header: avatar + nombre + categoría */}
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <Pressable
              style={styles.editBadge}
              hitSlop={6}
              onPress={() => Alert.alert('Editar perfil', 'Función próximamente disponible.')}
              accessibilityLabel="Editar perfil"
            >
              <Feather name="edit-2" size={12} color={colors.text.inverse} />
            </Pressable>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.categoryChip}>
            <Text style={styles.categoryChipText}>
              {user.category ? CATEGORY_LABELS[user.category] ?? user.category : '—'}
            </Text>
          </View>
          {user.email ? <Text style={styles.email}>{user.email}</Text> : null}
        </View>

        {/* Stat pills */}
        <View style={styles.pillsRow}>
          <StatCard variant="pill" value={metrics?.auctionsWon ?? 0} label="Victorias" />
          <StatCard variant="pill" value={metrics?.auctionsAttended ?? 0} label="Activas" />
          <StatCard variant="pill" value={metrics?.bidCount ?? 0} label="Ofertas" />
        </View>

        {/* Menú */}
        <View style={styles.menu}>
          <MenuRow
            icon="settings"
            title="Configuración"
            subtitle="Seguridad y preferencias"
            onPress={() => Alert.alert('Configuración', 'Función próximamente disponible.')}
          />
          <MenuRow
            icon="credit-card"
            title="Métodos de pago"
            subtitle="Métodos de pago habilitados"
            onPress={() => router.push('/payment-methods')}
          />
          <MenuRow
            icon="clock"
            title="Historial"
            subtitle="Historial de pagos y subastas"
            onPress={() => router.push('/(tabs)/purchases')}
          />
        </View>

        {!user.hasVerifiedPaymentMethod && (
          <View style={styles.warningBanner}>
            <Feather name="alert-circle" size={16} color={colors.feedback.warning} />
            <Text style={styles.warningText}>
              Necesitás al menos un medio de pago verificado para pujar.
            </Text>
          </View>
        )}

        {/* Logout */}
        <Pressable
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
          onPress={handleLogout}
          accessibilityRole="button"
        >
          <Feather name="log-out" size={18} color={colors.feedback.error} />
          <Text style={styles.logoutText}>SALIR</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>
        <Feather name={icon} size={20} color={colors.brand.primary} />
      </View>
      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  content: { padding: spacing.md, paddingBottom: spacing.xl },

  header: { alignItems: 'center', paddingVertical: spacing.lg },
  avatarWrap: { marginBottom: spacing.md },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontFamily: 'Inter_700Bold', fontSize: 40, color: colors.text.inverse },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.primary,
  },
  name: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.xs },
  categoryChip: {
    backgroundColor: colors.brand.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  categoryChipText: { ...typography.overline, color: colors.brand.primary },
  email: { ...typography.bodySmall, color: colors.text.tertiary, marginTop: spacing.sm },

  pillsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },

  menu: {
    backgroundColor: colors.background.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  menuTextWrap: { flex: 1 },
  menuTitle: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  menuSubtitle: { ...typography.caption, color: colors.text.secondary, marginTop: 1 },

  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  warningText: { ...typography.bodySmall, color: colors.feedback.warning, flex: 1, lineHeight: 18 },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.feedback.error,
    borderStyle: 'dashed',
  },
  logoutPressed: { opacity: 0.6 },
  logoutText: { ...typography.label, color: colors.feedback.error, letterSpacing: 1 },
});
