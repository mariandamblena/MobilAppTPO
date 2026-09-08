import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppDrawer } from '@/components/AppDrawer';
import { AppDrawerContext } from '@/navigation/AppDrawerContext';
import { colors, fonts, spacing } from '@/theme';

/**
 * Bottom tabs (decisión D1 — 4 tabs como el Figma): Home · Subastas · Mis pujas · Perfil.
 * Tab bar **custom** para controlar el layout (el default de react-navigation recortaba
 * las labels en react-native-web). Iconos vectoriales + labels overline + safe-area real.
 * Destinos secundarios quedan ocultos (`href: null`) y se alcanzan desde el drawer / campana.
 */
type IconPair = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };

const PRIMARY_TABS: Record<string, { title: string; icon: IconPair }> = {
  index: { title: 'Home', icon: { active: 'home', inactive: 'home-outline' } },
  subastas: { title: 'Subastas', icon: { active: 'hammer', inactive: 'hammer-outline' } },
  items: { title: 'Vender', icon: { active: 'pricetag', inactive: 'pricetag-outline' } },
  profile: { title: 'Perfil', icon: { active: 'person', inactive: 'person-outline' } },
};
const PRIMARY_ORDER = ['index', 'subastas', 'items', 'profile'];

function AuctifyTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeKey = state.routes[state.index]?.key;
  const activeName = state.routes[state.index]?.name;

  // Solo mostrar el bottom bar en los 4 tabs principales. En las vistas secundarias
  // (Compras, Mis artículos, Métricas, Notificaciones — abiertas desde drawer/campana)
  // no tiene sentido, así que se oculta por completo.
  if (!activeName || !PRIMARY_ORDER.includes(activeName)) return null;

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {PRIMARY_ORDER.map((name) => {
        const route = state.routes.find((r) => r.name === name);
        const conf = PRIMARY_TABS[name];
        if (!route || !conf) return null;

        const isFocused = route.key === activeKey;
        const color = isFocused ? colors.brand.primary : colors.text.secondary;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            style={styles.item}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={conf.title}
          >
            <Ionicons name={isFocused ? conf.icon.active : conf.icon.inactive} size={24} color={color} />
            <Text style={[styles.label, { color }]}>{conf.title.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AppDrawerContext.Provider value={{ openDrawer: () => setDrawerOpen(true) }}>
      <Tabs tabBar={(props) => <AuctifyTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="subastas" options={{ title: 'Subastas' }} />
        <Tabs.Screen name="items" options={{ title: 'Vender' }} />
        <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />

        {/* Ocultas del tab bar — accesibles desde el drawer / la campana */}
        <Tabs.Screen name="purchases" options={{ href: null }} />
        <Tabs.Screen name="mis-pujas" options={{ href: null }} />
        <Tabs.Screen name="metrics" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </AppDrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.5 },
});
