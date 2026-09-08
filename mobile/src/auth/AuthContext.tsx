import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '@/lib/storage';
import { get, post, postMultipart, setTokenGetter } from '@/api/client';
import type { Client } from '@/api/types';

// ─────────────── Constantes ───────────────

const TOKEN_KEY = 'auctify_jwt';

// ─────────────── Tipos ───────────────

export interface RegisterForm {
  document: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  countryId: number;
  idCardFront: ImagePicker.ImagePickerAsset;
  idCardBack: ImagePicker.ImagePickerAsset;
  photo?: ImagePicker.ImagePickerAsset;
}

export interface AuthContextValue {
  user: Client | null;
  loading: boolean;
  /** Inicia sesion con email y password. Guarda el JWT en SecureStore. */
  login: (email: string, password: string) => Promise<void>;
  /** Registro etapa 1 (multipart). */
  register: (form: RegisterForm) => Promise<void>;
  /** Activacion etapa 2: token del mail + nueva password. Guarda JWT. */
  activate: (token: string, password: string) => Promise<void>;
  /** Cierra sesion y borra el JWT de SecureStore. */
  logout: () => Promise<void>;
  /** Refresca el usuario desde GET /auth/me. */
  refreshMe: () => Promise<void>;
}

// ─────────────── Context ───────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

// ─────────────── Provider ───────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Client | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Inyectar el getter del token en el cliente API.
   * Se actualiza cada vez que cambia el token para evitar closures viejos.
   */
  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  /**
   * Hidratar la sesion desde SecureStore al abrir la app.
   */
  useEffect(() => {
    async function hydrate() {
      try {
        const storedToken = await storage.getItem(TOKEN_KEY);
        if (storedToken) {
          setToken(storedToken);
          setTokenGetter(() => storedToken);
          const me = await get<Client>('/auth/me');
          setUser(me);
        }
      } catch {
        // Token invalido o expirado — limpiar sesion
        await storage.deleteItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    hydrate();
  }, []);

  // ─── Persistir token ───

  async function persistToken(newToken: string) {
    await storage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setTokenGetter(() => newToken);
  }

  // ─── login ───

  const login = useCallback(async (email: string, password: string) => {
    const data = await post<{ token: string; user: Client }>('/auth/login', {
      email,
      password,
    });
    await persistToken(data.token);
    setUser(data.user);
  }, []);

  // ─── register (etapa 1, multipart) ───

  const register = useCallback(async (form: RegisterForm) => {
    const fields: Record<string, string | number> = {
      document: form.document,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      address: form.address,
      countryId: form.countryId,
    };

    const files: Record<string, { uri: string; name: string; type: string }> = {
      idCardFront: {
        uri: form.idCardFront.uri,
        name: `idcard-front-${form.document}.jpg`,
        type: form.idCardFront.mimeType ?? 'image/jpeg',
      },
      idCardBack: {
        uri: form.idCardBack.uri,
        name: `idcard-back-${form.document}.jpg`,
        type: form.idCardBack.mimeType ?? 'image/jpeg',
      },
    };

    if (form.photo) {
      files.photo = {
        uri: form.photo.uri,
        name: `photo-${form.document}.jpg`,
        type: form.photo.mimeType ?? 'image/jpeg',
      };
    }

    // La respuesta es { client, nextStep: "await_admission_email" }
    await postMultipart('/auth/register', fields, files);
    // No guardamos JWT — el usuario queda pendiente de admision
  }, []);

  // ─── activate (etapa 2) ───

  const activate = useCallback(async (activationToken: string, password: string) => {
    const data = await post<{ token: string; user: Client }>('/auth/activate', {
      token: activationToken,
      password,
    });
    await persistToken(data.token);
    setUser(data.user);
  }, []);

  // ─── logout ───

  const logout = useCallback(async () => {
    await storage.deleteItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setTokenGetter(() => null);
  }, []);

  // ─── refreshMe ───

  const refreshMe = useCallback(async () => {
    try {
      const me = await get<Client>('/auth/me');
      setUser(me);
    } catch {
      // Si falla (token expirado) cerrar sesion
      await logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, activate, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}
