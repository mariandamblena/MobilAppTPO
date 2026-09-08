import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { ApiError } from '@/api/client';

interface UsePollingOptions<T> {
  /** Intervalo entre requests (ms). Para live-status: 2000–3000. */
  intervalMs: number;
  /**
   * Decide si el nuevo valor difiere del anterior. Si devuelve false, NO se re-renderiza.
   * Para live-status: `(prev, next) => prev?.version !== next?.version`.
   */
  hasChanged?: (prev: T | undefined, next: T) => boolean;
  /** Permite pausar el polling manualmente (default true). */
  enabled?: boolean;
}

interface UsePollingResult<T> {
  data: T | undefined;
  loading: boolean;
  error: ApiError | null;
  /** Fuerza un fetch inmediato (ej. botón "reintentar"). */
  retry: () => void;
}

/**
 * Polling genérico con cadencia fija.
 *
 * - Se pausa automáticamente si la app pasa a background o se queda sin conexión.
 * - Solo actualiza el estado cuando `hasChanged` lo indica (evita re-render y datos viejos).
 * - Descarta respuestas que lleguen fuera de orden (las más viejas no pisan a las nuevas).
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs, hasChanged, enabled = true }: UsePollingOptions<T>,
): UsePollingResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Refs para no recrear el intervalo en cada render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const hasChangedRef = useRef(hasChanged);
  hasChangedRef.current = hasChanged;
  const dataRef = useRef<T | undefined>(undefined);
  const requestSeq = useRef(0);
  const activeRef = useRef(true); // foreground + online

  const tick = useCallback(async () => {
    if (!activeRef.current) return;
    const seq = ++requestSeq.current;
    try {
      const next = await fetcherRef.current();
      // Descartar respuestas fuera de orden (llegó una más nueva mientras esperábamos).
      if (seq !== requestSeq.current) return;
      const changed = hasChangedRef.current ? hasChangedRef.current(dataRef.current, next) : true;
      if (changed) {
        dataRef.current = next;
        setData(next);
      }
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof ApiError ? err : new ApiError('NETWORK_ERROR', 'Error de red.', 0));
      // No rompemos la pantalla: el próximo tick reintenta.
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    void tick();
  }, [tick]);

  useEffect(() => {
    if (!enabled) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      void tick();
      interval = setInterval(() => void tick(), intervalMs);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    // Pausar/reanudar según foreground.
    const appSub = AppState.addEventListener('change', (status: AppStateStatus) => {
      activeRef.current = status === 'active';
      if (status === 'active') start();
      else stop();
    });
    // Pausar/reanudar según conexión.
    const netSub = NetInfo.addEventListener((state) => {
      activeRef.current = state.isConnected !== false;
    });

    start();
    return () => {
      stop();
      appSub.remove();
      netSub();
    };
  }, [enabled, intervalMs, tick]);

  return { data, loading, error, retry };
}
