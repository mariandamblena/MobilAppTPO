/**
 * API client tipado para Auctify.
 *
 * Caracteristicas:
 * - Base URL desde EXPO_PUBLIC_API_URL
 * - Adjunta Authorization: Bearer <token> si hay sesion activa
 * - Timeout de 15 s via AbortController
 * - Parsea el envelope Error { code, message, details } del backend
 * - Helpers: get, post, patch, del, postMultipart
 *
 * El token se inyecta desde AuthContext via setTokenGetter().
 */

const DEFAULT_TIMEOUT_MS = 15_000;

// ─────────────── ApiError ───────────────

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// ─────────────── Token injection ───────────────

/** Funcion que devuelve el token JWT actual (o null si no hay sesion). */
type TokenGetter = () => string | null;

let _tokenGetter: TokenGetter = () => null;

/** Inyectado desde AuthContext al inicializar. */
export function setTokenGetter(getter: TokenGetter): void {
  _tokenGetter = getter;
}

// ─────────────── Base URL ───────────────

function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    console.warn('[api/client] EXPO_PUBLIC_API_URL no definida. Usando http://localhost:8080/v1');
    return 'http://localhost:8080/v1';
  }
  return url.replace(/\/$/, ''); // quitar trailing slash
}

// ─────────────── Core fetch ───────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const token = _tokenGetter();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'La solicitud tardó demasiado. Verificá tu conexión.', 0);
    }
    throw new ApiError('NETWORK_ERROR', 'Error de red. Verificá tu conexión.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  // Respuestas sin cuerpo (204 No Content)
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    // No pudo parsear JSON — respuesta inesperada del servidor
    throw new ApiError('PARSE_ERROR', 'Respuesta inesperada del servidor.', response.status);
  }

  if (!response.ok) {
    // Parsear el envelope Error del backend { code, message, details }
    const errorBody = responseBody as Partial<{ code: string; message: string; details: Record<string, unknown> }>;
    throw new ApiError(
      errorBody.code ?? 'UNKNOWN_ERROR',
      errorBody.message ?? 'Algo salió mal. Intentá de nuevo.',
      response.status,
      errorBody.details
    );
  }

  return responseBody as T;
}

// ─────────────── Multipart POST (registro de usuario) ───────────────

/**
 * POST multipart/form-data para el registro (POST /auth/register).
 * Permite adjuntar archivos (imagenes de documento).
 */
export async function postMultipart<T>(
  path: string,
  fields: Record<string, string | number>,
  files: Record<string, { uri: string; name: string; type: string }>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const token = _tokenGetter();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // No setear Content-Type manualmente — fetch lo hace con el boundary correcto

  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, String(value));
  }

  for (const [key, file] of Object.entries(files)) {
    // React Native acepta { uri, name, type } como si fuera un Blob
    formData.append(key, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }

  let response: Response;

  try {
    response = await fetch(`${getBaseUrl()}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if ((err as Error).name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'La solicitud tardó demasiado.', 0);
    }
    throw new ApiError('NETWORK_ERROR', 'Error de red.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch {
    throw new ApiError('PARSE_ERROR', 'Respuesta inesperada del servidor.', response.status);
  }

  if (!response.ok) {
    const errorBody = responseBody as Partial<{ code: string; message: string; details: Record<string, unknown> }>;
    throw new ApiError(
      errorBody.code ?? 'UNKNOWN_ERROR',
      errorBody.message ?? 'Algo salió mal.',
      response.status,
      errorBody.details
    );
  }

  return responseBody as T;
}

// ─────────────── Helpers publicos ───────────────

export function get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  return request<T>('GET', path, undefined, extraHeaders);
}

export function post<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  return request<T>('POST', path, body, extraHeaders);
}

export function patch<T>(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>
): Promise<T> {
  return request<T>('PATCH', path, body, extraHeaders);
}

export function del<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  return request<T>('DELETE', path, undefined, extraHeaders);
}
