import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { get, post } from '@/api/client';
import { AppBar } from '@/components/AppBar';
import { Loading } from '@/components/Loading';
import { EmptyState } from '@/components/EmptyState';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius, shadows } from '@/theme';
import type { Notification, NotificationType } from '@/api/types';
import type { ApiError } from '@/api/client';

const TYPE_META: Record<NotificationType, { icon: string; color: string }> = {
  admission:         { icon: 'check-circle', color: colors.feedback.success },
  auction_winner:    { icon: 'award', color: '#F59E0B' },
  inclusion_proposal:{ icon: 'clipboard', color: colors.brand.primary },
  penalty:           { icon: 'alert-triangle', color: colors.feedback.warning },
  item_rejected:     { icon: 'x-circle', color: colors.feedback.error },
  info:              { icon: 'info', color: colors.text.secondary },
};

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1)  return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7)    return `hace ${d} días`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

interface NotificationsResponse {
  items: Notification[];
  unreadCount: number;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchNotifications() {
    try {
      const data = await get<NotificationsResponse>('/me/notifications');
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (err) {
      setError((err as ApiError).message ?? 'No se pudieron cargar las notificaciones.');
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, []);

  function handleTap(item: Notification) {
    if (!item.read) {
      post(`/notifications/${item.id}/read`, {}).catch(() => {});
      setNotifications((prev) => prev.map((n) => n.id === item.id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    const payload = item.payload as Record<string, unknown> | undefined;
    if ((item.type === 'inclusion_proposal' || item.type === 'item_rejected') && payload?.inclusionRequestId) {
      router.push(`/items/${payload.inclusionRequestId}`);
    }
  }

  return (
    <View style={styles.screen}>
      <AppBar
        title="Notificaciones"
        rightAction={
          unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorView
          message={error}
          onRetry={() => {
            setLoading(true);
            fetchNotifications().finally(() => setLoading(false));
          }}
        />
      ) : (
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand.primary} />
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <EmptyState
            title="Sin notificaciones"
            message="Acá aparecerán tus notificaciones: admisión, pujas ganadas, propuestas de inclusión y más."
          />
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] ?? TYPE_META.info;
          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              onPress={() => handleTap(item)}
              activeOpacity={0.75}
            >
              <View style={[styles.iconWrap, { backgroundColor: meta.color + '18' }]}>
                <Feather name={meta.icon as any} size={22} color={meta.color} />
              </View>

              <View style={styles.body}>
                <View style={styles.topRow}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.date}>{relativeDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>

                <View style={[styles.typeBadge, { borderColor: meta.color }]}>
                  <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                    {item.type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
              </View>

              {!item.read && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        }}
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },

  unreadBadge: {
    backgroundColor: colors.feedback.error,
    borderRadius: radius.pill,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    ...typography.overline,
    color: '#FFFFFF',
    letterSpacing: 0,
  },

  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flex: 1 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.background.card,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.card,
  },
  cardUnread: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primaryLight,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  body: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.xs,
  },
  title: {
    ...typography.label,
    color: colors.text.primary,
    fontWeight: '700',
    flex: 1,
  },
  date: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: 1,
  },
  message: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  typeBadgeText: {
    ...typography.overline,
    fontSize: 9,
    letterSpacing: 0.8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.brand.primary,
    marginTop: 6,
    marginLeft: spacing.xs,
  },
});
