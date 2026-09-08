/**
 * Servicio de autenticación — lógica de negocio de auth.
 *
 * Registrar: crea Client admitted=false sin password.
 * Activar: valida ActivationToken → setea passwordHash → emite JWT.
 * Login: verifica credenciales → chequea admitted/blocked → emite JWT.
 * Me: carga el cliente del token.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { signToken } from "../../lib/jwt";
import {
  duplicateEntry,
  invalidToken,
  accountAlreadyActivated,
  notAdmitted,
  clientBlocked,
  unauthorized,
  notFound,
} from "../../lib/errors";

// Número de rounds de bcrypt — mayor es más seguro pero más lento
const BCRYPT_ROUNDS = 10;

// Duración del ActivationToken en horas
const TOKEN_EXPIRY_HOURS = 48;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Construye el payload del cliente para JWT y respuestas. */
function buildClientPayload(client: {
  id: number;
  document: string;
  category: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  admitted: boolean;
  blocked: boolean;
  active: boolean;
}) {
  // MVP: ADMIN se simula por category=platinum; en producción usar tabla de roles
  const roles: string[] = ["CLIENT"];
  if (client.category === "platinum") roles.push("ADMIN");

  return { roles, ...client };
}

/** Construye el objeto de usuario público (sin passwordHash). */
function sanitizeClient(client: {
  id: number;
  document: string;
  firstName: string;
  lastName: string;
  email: string | null;
  photoUrl: string | null;
  admitted: boolean;
  category: string | null;
  blocked: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  paymentMethods?: Array<{ id: number }>;
}) {
  const { paymentMethods, ...clientData } = client;

  return {
    id: clientData.id,
    document: clientData.document,
    firstName: clientData.firstName,
    lastName: clientData.lastName,
    email: clientData.email,
    photoUrl: clientData.photoUrl,
    admitted: clientData.admitted,
    category: clientData.category,
    blocked: clientData.blocked,
    active: clientData.active,
    createdAt: clientData.createdAt,
    updatedAt: clientData.updatedAt,
    hasVerifiedPaymentMethod: paymentMethods ? paymentMethods.length > 0 : false,
  };
}

// ── Operaciones ──────────────────────────────────────────────────────────────

export interface RegisterInput {
  document: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  countryId: number;
  photoUrl?: string;
  idCardFrontUrl?: string;
  idCardBackUrl?: string;
}

/**
 * Registro etapa 1 — crea Client admitted=false sin password.
 * Lanza DUPLICATE_ENTRY si el DNI o email ya existen.
 */
export async function register(input: RegisterInput) {
  // Chequear unicidad antes de intentar insertar
  const existing = await prisma.client.findFirst({
    where: {
      OR: [{ document: input.document }, { email: input.email }],
    },
  });

  if (existing) {
    if (existing.document === input.document) {
      throw duplicateEntry("El DNI ya está registrado");
    }
    throw duplicateEntry("El email ya está registrado");
  }

  const client = await prisma.client.create({
    data: {
      document: input.document,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      address: input.address,
      countryId: input.countryId,
      photoUrl: input.photoUrl ?? null,
      idCardFrontUrl: input.idCardFrontUrl ?? null,
      idCardBackUrl: input.idCardBackUrl ?? null,
      admitted: false,
      passwordHash: null,
      category: null,
      blocked: false,
      active: true,
    },
  });

  return sanitizeClient(client);
}

export interface ActivateInput {
  token: string;
  password: string;
}

/**
 * Activación etapa 2 — valida token, setea password, emite JWT.
 * Lanza INVALID_TOKEN si el token no existe, está vencido o ya fue usado.
 * Lanza ACCOUNT_ALREADY_ACTIVATED si el cliente ya tiene passwordHash.
 */
export async function activate(input: ActivateInput) {
  const activationToken = await prisma.activationToken.findUnique({
    where: { token: input.token },
    include: { client: true },
  });

  // Token inexistente
  if (!activationToken) {
    throw invalidToken("El token de activación no existe");
  }

  // Token expirado
  if (activationToken.expiresAt < new Date()) {
    throw invalidToken("El token de activación expiró");
  }

  // Token ya usado
  if (activationToken.usedAt) {
    throw invalidToken("El token de activación ya fue utilizado");
  }

  const client = activationToken.client;

  // Cuenta ya activada (ya tiene password)
  if (client.passwordHash) {
    throw accountAlreadyActivated();
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  // Actualizar cliente y marcar token como usado en una transacción
  const updatedClient = await prisma.$transaction(async (tx) => {
    await tx.activationToken.update({
      where: { id: activationToken.id },
      data: { usedAt: new Date() },
    });

    return tx.client.update({
      where: { id: client.id },
      data: { passwordHash },
      include: {
        paymentMethods: {
          where: { status: "verified" },
          select: { id: true },
        },
      },
    });
  });

  const payload = buildClientPayload(updatedClient);
  const jwtToken = signToken({
    sub: updatedClient.id,
    category: updatedClient.category,
    roles: payload.roles,
  });

  return { token: jwtToken, user: sanitizeClient(updatedClient) };
}

export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Login — verifica credenciales, admitted y blocked.
 * Lanza 401 si las credenciales son incorrectas.
 * Lanza NOT_ADMITTED (403) o CLIENT_BLOCKED (403) según el estado.
 */
export async function login(input: LoginInput) {
  const client = await prisma.client.findUnique({
    where: { email: input.email },
    include: {
      paymentMethods: {
        where: { status: "verified" },
        select: { id: true },
      },
    },
  });

  // No revelar si el email existe (evitar enumeración)
  if (!client || !client.passwordHash) {
    throw unauthorized("Email o contraseña incorrectos");
  }

  const passwordMatch = await bcrypt.compare(input.password, client.passwordHash);
  if (!passwordMatch) {
    throw unauthorized("Email o contraseña incorrectos");
  }

  // Chequeos de negocio después de validar credenciales
  if (!client.admitted) {
    throw notAdmitted();
  }

  if (client.blocked) {
    throw clientBlocked();
  }

  const payload = buildClientPayload(client);
  const jwtToken = signToken({
    sub: client.id,
    category: client.category,
    roles: payload.roles,
  });

  return { token: jwtToken, user: sanitizeClient(client) };
}

/**
 * Me — carga el cliente actual desde el token.
 * Incluye el campo derivado hasVerifiedPaymentMethod.
 */
export async function me(clientId: number) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      paymentMethods: {
        where: { status: "verified" },
        select: { id: true },
      },
    },
  });

  if (!client) {
    throw notFound("Cliente");
  }

  return sanitizeClient(client);
}

// ── Función utilitaria para el módulo clients (admisión) ─────────────────────

/**
 * Genera un ActivationToken para un cliente admitido.
 * Retorna el token en texto plano para que el admin pueda enviarlo por mail.
 * En desarrollo se devuelve en la respuesta HTTP directamente.
 */
export async function createActivationToken(clientId: number): Promise<string> {
  const tokenValue = `act_${crypto.randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.activationToken.create({
    data: {
      clientId,
      token: tokenValue,
      expiresAt,
    },
  });

  return tokenValue;
}
