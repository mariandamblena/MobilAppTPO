import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { colors, typography, fonts, spacing } from '@/theme';

interface DrawerLink {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  href: string;
}

/** Destinos fuera de los 4 tabs (decisión D1): viven en el drawer de la hamburguesa. */
const LINKS: DrawerLink[] = [
  { icon: 'shopping-bag', label: 'Compras', href: '/(tabs)/purchases' },
  { icon: 'tag', label: 'Mis pujas', href: '/(tabs)/mis-pujas' },
  { icon: 'bar-chart-2', label: 'Métricas', href: '/(tabs)/metrics' },
  { icon: 'bell', label: 'Notificaciones', href: '/(tabs)/notifications' },
  { icon: 'credit-card', label: 'Medios de pago', href: '/payment-methods' },
  { icon: 'alert-triangle', label: 'Mis multas', href: '/penalties' },
];

export function AppDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  function go(href: string) {
    onClose();
    router.push(href as Href);
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar menú" />
      <View style={[styles.panel, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>AUCTIFY</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Feather name="x" size={24} color={colors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {LINKS.map((link) => (
            <Pressable
              key={link.label}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => go(link.href)}
            >
              <View style={styles.rowIcon}>
                <Feather name={link.icon} size={20} color={colors.brand.primary} />
              </View>
              <Text style={styles.rowLabel}>{link.label}</Text>
              <Feather name="chevron-right" size={18} color={colors.text.tertiary} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 300,
    backgroundColor: colors.background.card,
    paddingHorizontal: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 22, color: colors.brand.primary, letterSpacing: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  rowPressed: { opacity: 0.6 },
  rowIcon: { width: 32 },
  rowLabel: { ...typography.body, color: colors.text.primary, flex: 1, fontWeight: '600' },
});
