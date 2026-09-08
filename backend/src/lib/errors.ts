/**
 * Códigos de error y clase AppError.
 */

/** Catálogo de códigos de error. Stable — el front los consume para decidir UX. */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INVALID_TOKEN: "INVALID_TOKEN",
  ACCOUNT_ALREADY_ACTIVATED: "ACCOUNT_ALREADY_ACTIVATED",
  NOT_ADMITTED: "NOT_ADMITTED",
  CATEGORY_INSUFFICIENT: "CATEGORY_INSUFFICIENT",
  NO_VERIFIED_PAYMENT_METHOD: "NO_VERIFIED_PAYMENT_METHOD",
  PAYMENT_METHOD_NOT_OWNED: "PAYMENT_METHOD_NOT_OWNED",
  CHECK_LIMIT_EXCEEDED: "CHECK_LIMIT_EXCEEDED",
  CLIENT_BLOCKED: "CLIENT_BLOCKED",
  NOT_CONNECTED: "NOT_CONNECTED",
  ALREADY_CONNECTED: "ALREADY_CONNECTED",
  BID_OUT_OF_RANGE: "BID_OUT_OF_RANGE",
  BID_SUPERSEDED: "BID_SUPERSEDED",
  MISSING_PHOTOS: "MISSING_PHOTOS",
  DECLARATION_REQUIRED: "DECLARATION_REQUIRED",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Error de aplicación con código semántico, HTTP status y detalles opcionales.
 * El error handler lo convierte al envelope { code, message, details }.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCodeType,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ── Factories de error frecuentes ─────────────────────────────────────────────

export function validationError(
  message: string,
  fields: Record<string, string>
): AppError {
  return new AppError(ErrorCode.VALIDATION_ERROR, 400, message, { fields });
}

export function notFound(resource = "Recurso"): AppError {
  return new AppError(
    ErrorCode.RESOURCE_NOT_FOUND,
    404,
    `${resource} no encontrado`
  );
}

export function duplicateEntry(message: string): AppError {
  return new AppError(ErrorCode.DUPLICATE_ENTRY, 409, message);
}

export function invalidToken(message = "Token inválido o expirado"): AppError {
  return new AppError(ErrorCode.INVALID_TOKEN, 400, message);
}

export function accountAlreadyActivated(): AppError {
  return new AppError(
    ErrorCode.ACCOUNT_ALREADY_ACTIVATED,
    409,
    "La cuenta ya fue activada"
  );
}

export function notAdmitted(): AppError {
  return new AppError(
    ErrorCode.NOT_ADMITTED,
    403,
    "La cuenta está pendiente de verificación por la empresa"
  );
}

export function clientBlocked(): AppError {
  return new AppError(
    ErrorCode.CLIENT_BLOCKED,
    403,
    "La cuenta está bloqueada. Regularizá tu situación antes de continuar"
  );
}

export function unauthorized(
  message = "Autenticación requerida"
): AppError {
  return new AppError(ErrorCode.UNAUTHORIZED, 401, message);
}

export function forbidden(message = "Sin permiso para esta acción"): AppError {
  return new AppError(ErrorCode.FORBIDDEN, 403, message);
}
