import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { usePolling } from '@/hooks/usePolling';
import { get, post } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { AppBar } from '@/components/AppBar';
import { Button } from '@/components/Button';
import { Loading } from '@/components/Loading';
import { ErrorView } from '@/components/ErrorView';
import { colors, typography, spacing, radius } from '@/theme';
import type { AuctionLiveStatus, PaymentMethod } from '@/api/types';
import type { ApiError } from '@/api/client';

interface AdminCatalogItem {
  id: number;
  lotNumber: number;
  basePrice: number | null;
  status: string; // 'pending' | 'active' | 'sold' | 'unsold'
  productId: number;
  catalogDescription?: string | null;
  product?: {
    catalogDescription?: string | null;
    fullDescription?: string;
  } | null;
}

interface AdminCatalogResponse {
  items?: AdminCatalogItem[];
}

interface CloseItemResult {
  sold: boolean;
  winnerBidderNumber?: number | null;
  amount?: number | null;
  message?: string | null;
}

type ConnectState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error';

export default function AuctionLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // ── Estado de la conexión ────────────────────────────────────────────────
  const [connectState, setConnectState] = useState<ConnectState>('idle');
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Medios de pago verificados del cliente ───────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(null);
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);

  // ── Estado de la puja ────────────────────────────────────────────────────
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ amount: number; at: Date } | null>(null);

  // ── Estado del panel de remate (solo admins) ────────────────────────────
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [catalog, setCatalog] = useState<AdminCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  /** id del ítem sobre el que hay una acción en curso (open/close) */
  const [actionItemId, setActionItemId] = useState<number | null>(null);
  const [closingAuction, setClosingAuction] = useState(false);

  // Ref para desconectar al desmontar sin generar dependencia extra
  const auctionId = id;
  const disconnectOnUnmount = useRef(false);

  // ── Polling del estado en vivo ──────────────────────────────────────────
  // Solo activo cuando estamos conectados
  const {
    data: liveStatus,
    loading: pollLoading,
    error: pollError,
    retry: retryPoll,
  } = usePolling<AuctionLiveStatus>(
    () => get<AuctionLiveStatus>(`/auctions/${auctionId}/live-status`),
    {
      intervalMs: 2500,
      // Solo re-renderiza si la version cambio (ADR-002)
      hasChanged: (prev, next) => prev?.version !== next?.version,
      // Pausa el polling si no estamos conectados
      enabled: connectState === 'connected',
    }
  );

  // ── Conexión al montar ────────────────────────────────────────────────────

  const connectToAuction = useCallback(async () => {
    setConnectState('connecting');
    setConnectError(null);

    try {
      await post(`/auctions/${auctionId}/connect`, {});
      setConnectState('connected');
      disconnectOnUnmount.current = true;
    } catch (err) {
      const apiError = err as ApiError;

      if (apiError.code === 'ALREADY_CONNECTED') {
        // Hay una sesión activa en otra subasta — ofrecer desconectar
        const otherAuctionId = (apiError.details as Record<string, unknown>)?.auctionId;
        Alert.alert(
          'Ya estás conectado',
          `Estás conectado a otra subasta. ¿Querés desconectarte para unirte a ésta?`,
          [
            {
              text: 'Cancelar',
              style: 'cancel',
              onPress: () => {
                setConnectState('error');
                setConnectError('Cancelaste la conexión.');
              },
            },
            {
              text: 'Desconectarme',
              onPress: async () => {
                try {
                  if (otherAuctionId) {
                    await post(`/auctions/${otherAuctionId}/disconnect`, {});
                  }
                  // Reintentar la conexión
                  await post(`/auctions/${auctionId}/connect`, {});
                  setConnectState('connected');
                  disconnectOnUnmount.current = true;
                } catch (retryErr) {
                  const retryApiError = retryErr as ApiError;
                  setConnectState('error');
                  setConnectError(
                    retryApiError.message ?? 'No se pudo conectar. Intentá de nuevo.'
                  );
                }
              },
            },
          ]
        );
      } else {
        // Errores 403 u otros
        setConnectState('error');
        setConnectError(mapConnectError(apiError));
      }
    }
  }, [auctionId]);

  // ── Desconexión al desmontar ─────────────────────────────────────────────

  useEffect(() => {
    // Esperar a que se hidrate la sesión (token disponible) antes de conectar.
    // Evita el race en cold-load de /auction/:id (connect sin JWT → 401).
    if (authLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    void connectToAuction();

    return () => {
      // Best-effort: no esperamos la respuesta al desmontar
      if (disconnectOnUnmount.current) {
        void post(`/auctions/${auctionId}/disconnect`, {}).catch(() => {
          // Ignorar errores de desconexión al salir
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, authLoading, user]);

  // ── Cargar medios de pago verificados ────────────────────────────────────

  useEffect(() => {
    if (connectState !== 'connected') return;

    async function loadPaymentMethods() {
      try {
        const methods = await get<PaymentMethod[]>('/me/payment-methods');
        const verified = methods.filter((m) => m.status === 'verified');
        setPaymentMethods(verified);
        // Pre-seleccionar el primer medio si solo hay uno
        if (verified.length === 1) {
          setSelectedPaymentMethodId(verified[0].id);
        }
      } catch {
        // Si falla no bloqueamos la pantalla; el usuario puede seguir viendo
      }
    }

    void loadPaymentMethods();
  }, [connectState]);

  // ── Desconexión manual ───────────────────────────────────────────────────

  const handleDisconnect = useCallback(async () => {
    try {
      await post(`/auctions/${auctionId}/disconnect`, {});
      disconnectOnUnmount.current = false;
    } catch {
      // Ignorar errores; igual volvemos atrás
    }
    router.back();
  }, [auctionId, router]);

  // ── Puja ──────────────────────────────────────────────────────────────────

  const handleBid = useCallback(async () => {
    if (!liveStatus?.currentItem) return;
    setBidError(null);

    const amount = parseFloat(bidAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      setBidError('Ingresá un importe válido');
      return;
    }

    // Validación local de rango
    const { minBidAllowed, maxBidAllowed } = liveStatus.currentItem;
    if (minBidAllowed !== null && minBidAllowed !== undefined && amount < minBidAllowed) {
      setBidError(`El mínimo permitido es ${formatCurrency(minBidAllowed)}`);
      return;
    }
    if (maxBidAllowed !== null && maxBidAllowed !== undefined && amount > maxBidAllowed) {
      setBidError(`El máximo permitido es ${formatCurrency(maxBidAllowed)}`);
      return;
    }

    if (!selectedPaymentMethodId) {
      setBidError('Seleccioná un medio de pago');
      return;
    }

    // Bloquear el botón hasta la confirmación 201 (regla "una puja a la vez")
    setSubmitting(true);

    // Generar Idempotency-Key única para esta puja (formato: userId-itemId-timestamp)
    const idempotencyKey = `${user?.id ?? 'anon'}-${liveStatus.currentItem.itemId}-${Date.now()}`;

    try {
      await post(
        `/items/${liveStatus.currentItem.itemId}/bids`,
        {
          amount,
          paymentMethodId: selectedPaymentMethodId,
          // Pasamos el bestBid conocido para detección de BID_SUPERSEDED en el backend
          knownBestBid: liveStatus.currentItem.bestBid ?? null,
        },
        { 'Idempotency-Key': idempotencyKey }
      );

      // 201 — puja registrada → modal de éxito
      setSuccessInfo({ amount, at: new Date() });
      setBidAmount('');
    } catch (err) {
      const apiError = err as ApiError;

      switch (apiError.code) {
        case 'BID_OUT_OF_RANGE': {
          // El backend devuelve details.minAllowed y details.maxAllowed
          const details = (apiError.details ?? {}) as Record<string, number | null>;
          const min = details.minAllowed;
          const max = details.maxAllowed;
          setBidError(
            min !== null && min !== undefined
              ? max !== null && max !== undefined
                ? `Fuera de rango. Mínimo: ${formatCurrency(min)}, Máximo: ${formatCurrency(max)}`
                : `El mínimo permitido es ${formatCurrency(min)}`
              : 'Importe fuera de rango. Refrescá e intentá de nuevo.'
          );
          break;
        }
        case 'BID_SUPERSEDED':
          // Alguien pujó mientras tanto; el polling refrescará el estado
          setBidError('Otro postor pujó antes que vos. Refrescá el estado y volvé a intentar.');
          retryPoll();
          break;
        case 'NOT_CONNECTED':
          setBidError('No estás conectado a esta subasta. Volvé a entrar.');
          setConnectState('error');
          setConnectError('Sesión perdida. Volvé a conectarte.');
          break;
        case 'NO_VERIFIED_PAYMENT_METHOD':
          setBidError('No tenés un medio de pago verificado. Agregá uno desde tu perfil.');
          break;
        case 'CLIENT_BLOCKED':
          setBidError('Tu cuenta está bloqueada. Abonás la multa pendiente para continuar.');
          break;
        case 'CHECK_LIMIT_EXCEEDED':
          setBidError('Superaste el límite del cheque certificado. Elegí otro medio de pago.');
          break;
        case 'PAYMENT_METHOD_NOT_OWNED':
          setBidError('El medio de pago seleccionado no te pertenece.');
          break;
        default:
          setBidError(apiError.message ?? 'Error al registrar la puja. Intentá de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    liveStatus,
    bidAmount,
    selectedPaymentMethodId,
    user?.id,
    retryPoll,
  ]);

  // ── Panel de remate — helpers de admin ──────────────────────────────────

  /**
   * Un usuario es admin si su categoría es 'platinum'.
   * En dev el backend permite cualquier usuario autenticado para todas las
   * rutas /auctions/:id/items/:itemId/open|close y /auctions/:id/close.
   */
  const isAdmin = user?.category === 'platinum';

  /** Carga (o recarga) el catálogo de la subasta. */
  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await get<AdminCatalogItem[] | AdminCatalogResponse>(
        `/auctions/${auctionId}/catalog`
      );
      const items = Array.isArray(result) ? result : result.items;
      setCatalog(Array.isArray(items) ? items : []);
    } catch (err) {
      const apiError = err as ApiError;
      setCatalogError(apiError.message ?? 'No se pudo cargar el catálogo.');
    } finally {
      setCatalogLoading(false);
    }
  }, [auctionId]);

  /** Abre el panel y carga el catálogo la primera vez que se expande. */
  const handleTogglePanel = useCallback(() => {
    setPanelExpanded((prev) => {
      const next = !prev;
      if (next && catalog.length === 0) {
        void loadCatalog();
      }
      return next;
    });
  }, [catalog.length, loadCatalog]);

  /** Abre un ítem (POST /auctions/:id/items/:itemId/open). */
  const handleOpenItem = useCallback(async (itemId: number) => {
    setActionItemId(itemId);
    try {
      await post(`/auctions/${auctionId}/items/${itemId}/open`, {});
      // Refrescar catálogo y estado en vivo
      void loadCatalog();
      retryPoll();
    } catch (err) {
      const apiError = err as ApiError;
      Alert.alert('Error al abrir ítem', apiError.message ?? 'No se pudo abrir el ítem.');
    } finally {
      setActionItemId(null);
    }
  }, [auctionId, loadCatalog, retryPoll]);

  /** Adjudica y cierra un ítem (POST /auctions/:id/items/:itemId/close). */
  const handleCloseItem = useCallback(async (itemId: number) => {
    setActionItemId(itemId);
    try {
      const result = await post<CloseItemResult>(
        `/auctions/${auctionId}/items/${itemId}/close`,
        {}
      );
      // Mostrar resultado: ganador o sin ofertas
      const msg = result.sold
        ? `Ítem adjudicado al postor #${result.winnerBidderNumber ?? '—'} por ${
            result.amount != null ? formatCurrency(result.amount) : '—'
          }.`
        : 'Ítem cerrado sin ofertas.';
      Alert.alert('Ítem cerrado', msg);
      void loadCatalog();
      retryPoll();
    } catch (err) {
      const apiError = err as ApiError;
      Alert.alert('Error al cerrar ítem', apiError.message ?? 'No se pudo cerrar el ítem.');
    } finally {
      setActionItemId(null);
    }
  }, [auctionId, loadCatalog, retryPoll]);

  /** Cierra la subasta completa (POST /auctions/:id/close). */
  const handleCloseAuction = useCallback(async () => {
    Alert.alert(
      'Cerrar subasta',
      '¿Confirmás que querés cerrar la subasta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar subasta',
          style: 'destructive',
          onPress: async () => {
            setClosingAuction(true);
            try {
              await post(`/auctions/${auctionId}/close`, {});
              Alert.alert('Subasta cerrada', 'La subasta fue cerrada exitosamente.');
              retryPoll();
            } catch (err) {
              const apiError = err as ApiError;
              Alert.alert(
                'Error al cerrar subasta',
                apiError.message ?? 'No se pudo cerrar la subasta.'
              );
            } finally {
              setClosingAuction(false);
            }
          },
        },
      ]
    );
  }, [auctionId, retryPoll]);

  // ── Renders de estado ─────────────────────────────────────────────────────

  if (connectState === 'idle' || connectState === 'connecting') {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta en vivo" />
        <Loading />
      </View>
    );
  }

  if (connectState === 'error') {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta en vivo" />
        <ErrorView
          message={connectError ?? 'No se pudo conectar a la subasta.'}
          onRetry={() => void connectToAuction()}
        />
      </View>
    );
  }

  // connectState === 'connected'
  if (pollLoading && !liveStatus) {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta en vivo" />
        <Loading />
      </View>
    );
  }

  if (pollError && !liveStatus) {
    return (
      <View style={styles.screen}>
        <AppBar title="Subasta en vivo" />
        <ErrorView
          message="No se pudo cargar el estado de la subasta."
          onRetry={retryPoll}
        />
      </View>
    );
  }

  const item = liveStatus?.currentItem;
  const canBid =
    connectState === 'connected' &&
    liveStatus?.auctionStatus === 'open' &&
    !!item &&
    paymentMethods.length > 0;

  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId);
  const isCurrentlyWinning = !!liveStatus?.youAreLeading;

  return (
    <View style={styles.screen}>
      <AppBar
        title="Subasta en vivo"
        onBack={handleDisconnect}
        rightAction={
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>
              {liveStatus?.connectedCount ?? '—'} conectados
            </Text>
          </View>
        }
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Estado de la subasta */}
      <View style={styles.statusRow}>
        <View style={styles.liveDot} />
        <Text style={styles.statusLabel}>
          {liveStatus?.auctionStatus === 'open' ? 'En curso' : 'Cerrada'}
        </Text>
        {/* Banner de reconexión si el polling falla ≥2 veces (detectado por pollError) */}
        {pollError && (
          <Text style={styles.reconnectingText}>Reconectando…</Text>
        )}
      </View>

      {/* Ítem activo */}
      {item ? (
        <View style={styles.itemCard}>
          <Text style={styles.itemDescription}>{item.catalogDescription}</Text>

          {/* Mejor oferta */}
          <View style={styles.bidRow}>
            <View>
              <Text style={styles.bidLabel}>Mejor oferta</Text>
              <Text style={styles.bidAmount}>
                {item.bestBid != null ? formatCurrency(item.bestBid) : 'Sin ofertas'}
              </Text>
            </View>
            {item.bestBidBidderNumber != null && (
              <View style={styles.bidderBadge}>
                <Text style={styles.bidderText}>Postor #{item.bestBidBidderNumber}</Text>
              </View>
            )}
          </View>

          {/* Rango permitido */}
          <View style={styles.rangeRow}>
            {item.minBidAllowed != null ? (
              <Text style={styles.rangeText}>
                Min: {formatCurrency(item.minBidAllowed)}
              </Text>
            ) : null}
            {item.maxBidAllowed != null ? (
              <Text style={styles.rangeText}>
                Max: {formatCurrency(item.maxBidAllowed)}
              </Text>
            ) : null}
            {item.minBidAllowed === null && item.maxBidAllowed === null ? (
              <Text style={styles.rangeText}>Sin límites de rango</Text>
            ) : null}
          </View>

          {/* Cantidad de pujas */}
          <Text style={styles.bidCount}>{item.bidCount} puja(s)</Text>

          {/* Banner "Vas ganando" */}
          {isCurrentlyWinning && (
            <View style={styles.winningBanner}>
              <View style={styles.winningDot} />
              <Text style={styles.winningText}>¡Vas ganando! Tu oferta es la más alta.</Text>
            </View>
          )}

          {/* Banner "Te superaron" */}
          {liveStatus?.youWereOutbid && (
            <View style={styles.outbidBanner}>
              <Text style={styles.outbidText}>
                ¡Te superaron! Podés mejorar tu oferta.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.itemCard}>
          <Text style={styles.noItemText}>
            {liveStatus?.auctionStatus === 'closed'
              ? 'La subasta ha finalizado.'
              : 'Esperando el próximo ítem…'}
          </Text>
        </View>
      )}

      {/* Caja de puja */}
      {canBid ? (
        <View style={styles.bidBox}>
          <Text style={styles.bidBoxTitle}>Realizar puja</Text>

          {/* Feedback de error */}
          {bidError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{bidError}</Text>
            </View>
          ) : null}

          {/* Input de importe */}
          <Text style={styles.inputLabel}>Importe a pujar</Text>
          <TextInput
            style={styles.amountInput}
            value={bidAmount}
            onChangeText={(t) => {
              setBidAmount(t);
              setBidError(null);
            }}
            placeholder={
              item?.minBidAllowed != null
                ? `Mín: ${formatCurrency(item.minBidAllowed)}`
                : 'Importe'
            }
            keyboardType="decimal-pad"
            editable={!submitting}
            accessibilityLabel="Importe de la puja"
          />

          {/* Selector de medio de pago */}
          <Text style={styles.inputLabel}>Medio de pago</Text>
          <TouchableOpacity
            style={styles.paymentSelector}
            onPress={() => setShowPaymentSelector((v) => !v)}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Seleccionar medio de pago"
          >
            <Text style={styles.paymentSelectorText}>
              {selectedMethod
                ? `${paymentMethodLabel(selectedMethod)}`
                : 'Seleccioná un medio de pago'}
            </Text>
            <Text style={styles.paymentSelectorChevron}>
              {showPaymentSelector ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>

          {/* Lista desplegable de medios de pago */}
          {showPaymentSelector && (
            <View style={styles.paymentDropdown}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
              >
                {paymentMethods.map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.paymentOption,
                      method.id === selectedPaymentMethodId && styles.paymentOptionSelected,
                    ]}
                    onPress={() => {
                      setSelectedPaymentMethodId(method.id);
                      setShowPaymentSelector(false);
                      setBidError(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.paymentOptionText,
                        method.id === selectedPaymentMethodId &&
                          styles.paymentOptionTextSelected,
                      ]}
                    >
                      {paymentMethodLabel(method)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Botón Pujar — deshabilitado mientras hay una puja en curso */}
          <Button
            title={submitting ? 'Registrando…' : 'Pujar'}
            onPress={handleBid}
            loading={submitting}
            disabled={submitting}
            style={styles.bidButton}
          />
        </View>
      ) : connectState === 'connected' && paymentMethods.length === 0 ? (
        <View style={styles.noBidBanner}>
          <Text style={styles.noBidText}>
            Necesitás un medio de pago verificado para pujar. Agregalo desde tu perfil.
          </Text>
        </View>
      ) : connectState === 'connected' && liveStatus?.auctionStatus === 'closed' ? (
        <View style={styles.noBidBanner}>
          <Text style={styles.noBidText}>La subasta está cerrada.</Text>
        </View>
      ) : null}

      {isAdmin && (
        <View style={styles.adminPanel}>
          <TouchableOpacity
            style={styles.adminPanelHeader}
            onPress={handleTogglePanel}
            accessibilityRole="button"
            accessibilityLabel={panelExpanded ? 'Colapsar panel de remate' : 'Expandir panel de remate'}
          >
            <Text style={styles.adminPanelTitle}>Panel de remate</Text>
            <Text style={styles.adminPanelChevron}>{panelExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {panelExpanded && (
            <View style={styles.adminPanelBody}>
              <Button
                title={catalogLoading ? 'Cargando…' : 'Recargar catálogo'}
                variant="outline"
                loading={catalogLoading}
                onPress={() => void loadCatalog()}
                style={styles.adminReloadBtn}
              />

              {catalogError !== null && (
                <View style={styles.adminErrorBanner}>
                  <Text style={styles.adminErrorText}>{catalogError}</Text>
                </View>
              )}

              {catalog.length === 0 && !catalogLoading && !catalogError && (
                <Text style={styles.adminEmptyText}>Sin ítems en el catálogo.</Text>
              )}

              {catalog.map((catItem) => {
                const label =
                  catItem.product?.catalogDescription ??
                  catItem.catalogDescription ??
                  `Lote #${catItem.lotNumber}`;
                const isPending = catItem.status === 'pending';
                const isActive = catItem.status === 'active';
                const isClosed =
                  catItem.status === 'sold' || catItem.status === 'unsold';
                const isBusy = actionItemId === catItem.id;

                return (
                  <View key={catItem.id} style={styles.adminItemRow}>
                    <View style={styles.adminItemInfo}>
                      <Text style={styles.adminItemLot}>Lote #{catItem.lotNumber}</Text>
                      <Text style={styles.adminItemDesc} numberOfLines={2}>
                        {label}
                      </Text>
                      <View
                        style={[
                          styles.adminStatusBadge,
                          isActive && styles.adminStatusBadgeActive,
                          isClosed && styles.adminStatusBadgeClosed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.adminStatusText,
                            isActive && styles.adminStatusTextActive,
                            isClosed && styles.adminStatusTextClosed,
                          ]}
                        >
                          {catItem.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.adminItemActions}>
                      {isPending && (
                        <Button
                          title={isBusy ? '…' : 'Abrir'}
                          loading={isBusy}
                          disabled={isBusy}
                          onPress={() => void handleOpenItem(catItem.id)}
                          style={styles.adminActionBtn}
                        />
                      )}
                      {isActive && (
                        <Button
                          title={isBusy ? '…' : 'Adjudicar y cerrar'}
                          loading={isBusy}
                          disabled={isBusy}
                          onPress={() => void handleCloseItem(catItem.id)}
                          style={[styles.adminActionBtn, styles.adminCloseBtn]}
                        />
                      )}
                    </View>
                  </View>
                );
              })}

              <View style={styles.adminDivider} />
              <Button
                title={closingAuction ? 'Cerrando subasta…' : 'Cerrar subasta'}
                variant="outline"
                loading={closingAuction}
                disabled={closingAuction}
                onPress={() => void handleCloseAuction()}
                style={styles.adminCloseAuctionBtn}
              />
            </View>
          )}
        </View>
      )}
      </ScrollView>

      {/* Modal unificado de puja: "enviando" y "éxito" usan la misma instancia para evitar
          el bug de React Native donde montar+desmontar dos Modals en el mismo frame congela los toques */}
      <Modal
        visible={submitting || !!successInfo}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!submitting) setSuccessInfo(null); }}
      >
        {submitting ? (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Text style={styles.sendingLabel}>TU PUJA</Text>
              <Text style={styles.sendingAmount}>
                {formatCurrency(parseFloat(bidAmount.replace(',', '.')) || 0)}
              </Text>
              <View style={styles.sendingRow}>
                <ActivityIndicator color={colors.brand.primary} />
                <Text style={styles.sendingText}>Enviando al sistema…</Text>
              </View>
              <View style={styles.importanteBox}>
                <Text style={styles.importanteLabel}>IMPORTANTE</Text>
                <Text style={styles.importanteText}>
                  No podés hacer otra puja hasta que el servidor confirme esta.
                </Text>
              </View>
            </View>
          </View>
        ) : successInfo ? (
          <Pressable
            style={styles.overlay}
            onPress={() => setSuccessInfo(null)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar confirmación de puja"
          >
            <Pressable
              style={styles.sheet}
              onPress={(event) => event.stopPropagation()}
            >
              <ScrollView
                style={styles.successScroll}
                contentContainerStyle={styles.successContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.successCheck}>
                  <Feather name="check" size={30} color={colors.text.inverse} />
                </View>
                <Text style={styles.successTitle}>¡Puja exitosa!</Text>
                <View style={styles.winBadge}>
                  <View style={styles.winDot} />
                  <Text style={styles.winText}>Ganando</Text>
                </View>

                <View style={styles.successAmountBox}>
                  <Text style={styles.successAmountLabel}>Subasta ganadora actual</Text>
                  <Text style={styles.successAmount}>
                    {formatCurrency(successInfo.amount)}
                  </Text>
                  <Text style={styles.successAmountSub}>Tu oferta es actualmente la más alta.</Text>
                </View>

                {item ? (
                  <View style={styles.successItem}>
                    <Text style={styles.successItemName} numberOfLines={1}>{item.catalogDescription}</Text>
                    <Text style={styles.successItemSub}>
                      {successInfo.at.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                  </View>
                ) : null}

                <Button
                  title="Ver mis ofertas"
                  onPress={() => {
                    setSuccessInfo(null);
                    router.push('/(tabs)/mis-pujas');
                  }}
                  style={styles.successBtn}
                />
                <Button
                  title="Volver a la subasta"
                  variant="outline"
                  onPress={() => setSuccessInfo(null)}
                  style={styles.successBtn}
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        ) : null}
      </Modal>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Formatea un número al estilo moneda argentina. */
function formatCurrency(value: number): string {
  return value.toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

/** Etiqueta legible para un medio de pago. */
function paymentMethodLabel(method: PaymentMethod): string {
  const typeLabels: Record<string, string> = {
    bank_account: 'Cuenta bancaria',
    credit_card: 'Tarjeta de crédito',
    certified_check: 'Cheque certificado',
  };
  const type = typeLabels[method.type] ?? method.type;
  const extra = method.bank ? ` — ${method.bank}` : '';
  return `${type}${extra} (${method.currency})`;
}

/** Traduce errores de conexión a mensajes amigables. */
function mapConnectError(err: ApiError): string {
  switch (err.code) {
    case 'NOT_ADMITTED':
      return 'Tu cuenta no está verificada aún.';
    case 'CLIENT_BLOCKED':
      return 'Tu cuenta está bloqueada. Regularizá tu situación para continuar.';
    case 'CATEGORY_INSUFFICIENT':
      return 'Tu categoría no es suficiente para esta subasta.';
    case 'NO_VERIFIED_PAYMENT_METHOD':
      return 'Necesitás al menos un medio de pago verificado para conectarte.';
    case 'VALIDATION_ERROR':
      return 'La subasta no está abierta en este momento.';
    default:
      return err.message ?? 'No se pudo conectar a la subasta. Intentá de nuevo.';
  }
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.primary },
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    padding: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  connectedBadge: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  connectedText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.feedback.live,
  },
  statusLabel: {
    ...typography.label,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reconnectingText: {
    ...typography.caption,
    color: colors.feedback.warning,
    fontStyle: 'italic',
    marginLeft: spacing.xs,
  },
  itemCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemDescription: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  bidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  bidLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bidAmount: {
    ...typography.heading2,
    color: colors.brand.accent,
    fontWeight: '800',
  },
  bidderBadge: {
    backgroundColor: colors.brand.primaryLight,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  bidderText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  rangeText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  bidCount: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  winningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.feedback.successBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.success,
  },
  winningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.feedback.success,
  },
  winningText: {
    ...typography.bodySmall,
    color: colors.feedback.success,
    fontWeight: '700',
    flex: 1,
  },
  outbidBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.warning,
  },
  outbidText: {
    ...typography.bodySmall,
    color: colors.feedback.warning,
    fontWeight: '600',
  },
  noItemText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  bidBox: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  bidBoxTitle: {
    ...typography.heading3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.error,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  inputLabel: {
    ...typography.label,
    color: colors.text.secondary,
    marginBottom: 4,
    marginTop: spacing.xs,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
    marginBottom: spacing.sm,
  },
  paymentSelector: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
  },
  paymentSelectorText: {
    ...typography.body,
    color: colors.text.primary,
    flex: 1,
  },
  paymentSelectorChevron: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginLeft: spacing.xs,
  },
  paymentDropdown: {
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: 8,
    backgroundColor: colors.background.card,
    marginBottom: spacing.sm,
    maxHeight: 180,
    overflow: 'hidden',
  },
  paymentOption: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  paymentOptionSelected: {
    backgroundColor: colors.background.highlight,
  },
  paymentOptionText: {
    ...typography.body,
    color: colors.text.primary,
  },
  paymentOptionTextSelected: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  bidButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand.accent,
  },
  noBidBanner: {
    backgroundColor: colors.feedback.warningBackground,
    borderRadius: 10,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.warning,
  },
  noBidText: {
    ...typography.body,
    color: colors.feedback.warning,
    lineHeight: 22,
  },

  // ── Panel de remate (admin) ──────────────────────────────────────────────

  adminPanel: {
    marginTop: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '40',
    overflow: 'hidden',
  },
  adminPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.brand.primaryLight,
  },
  adminPanelTitle: {
    ...typography.label,
    color: colors.brand.primary,
    fontWeight: '700',
  },
  adminPanelChevron: {
    ...typography.caption,
    color: colors.brand.primary,
  },
  adminPanelBody: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  adminReloadBtn: {
    marginBottom: spacing.sm,
  },
  adminErrorBanner: {
    backgroundColor: colors.feedback.errorBackground,
    borderRadius: 8,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.feedback.error,
    marginBottom: spacing.sm,
  },
  adminErrorText: {
    ...typography.bodySmall,
    color: colors.feedback.error,
  },
  adminEmptyText: {
    ...typography.bodySmall,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  adminItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: spacing.sm,
  },
  adminItemInfo: {
    flex: 1,
    gap: 2,
  },
  adminItemLot: {
    ...typography.overline,
    color: colors.text.tertiary,
  },
  adminItemDesc: {
    ...typography.bodySmall,
    color: colors.text.primary,
  },
  adminStatusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginTop: 2,
  },
  adminStatusBadgeActive: {
    backgroundColor: colors.feedback.successBackground,
  },
  adminStatusBadgeClosed: {
    backgroundColor: colors.background.secondary,
  },
  adminStatusText: {
    ...typography.overline,
    color: colors.text.tertiary,
    letterSpacing: 0.5,
  },
  adminStatusTextActive: {
    color: colors.feedback.success,
  },
  adminStatusTextClosed: {
    color: colors.text.tertiary,
  },
  adminItemActions: {
    flexShrink: 0,
  },
  adminActionBtn: {
    minWidth: 90,
    paddingHorizontal: spacing.sm,
  },
  adminCloseBtn: {
    backgroundColor: colors.feedback.error,
  },
  adminDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: spacing.sm,
  },
  adminCloseAuctionBtn: {
    borderColor: colors.feedback.error,
  },

  // ── Modales de puja (enviando / éxito) ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '85%',
    backgroundColor: colors.background.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  sendingLabel: { ...typography.overline, color: colors.text.tertiary },
  sendingAmount: { ...typography.display, color: colors.text.primary, marginVertical: spacing.xs },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sendingText: { ...typography.body, color: colors.text.secondary },
  importanteBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderStyle: 'dashed',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  importanteLabel: { ...typography.overline, color: colors.text.tertiary, marginBottom: 2 },
  importanteText: { ...typography.bodySmall, color: colors.text.secondary },

  successCheck: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.feedback.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  successTitle: { ...typography.heading2, color: colors.text.primary, marginBottom: spacing.xs },
  successScroll: {
    width: '100%',
  },
  successContent: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.feedback.successBackground,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  winDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.feedback.success },
  winText: { ...typography.caption, color: colors.feedback.success, fontWeight: '700' },
  successAmountBox: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successAmountLabel: { ...typography.bodySmall, color: colors.text.secondary },
  successAmount: { ...typography.heading1, color: colors.brand.primary, marginVertical: 2 },
  successAmountSub: { ...typography.caption, color: colors.text.tertiary },
  successItem: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  successItemName: { ...typography.label, color: colors.text.primary },
  successItemSub: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },
  successBtn: { width: '100%', marginTop: spacing.sm },
});
