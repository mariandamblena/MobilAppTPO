# Auctify Backend

API REST del sistema de subastas Auctify. Construido con Node 24, Express 4, TypeScript 5, Prisma y SQLite.

## Prerrequisitos

- Node.js >= 20 (recomendado 24)
- npm >= 10

## Setup (orden importante)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env si hace falta (JWT_SECRET en particular para producción)

# 3. Crear la base de datos y correr las migraciones
npm run prisma:migrate
# Cuando pida nombre de migración: "init"

# 4. Sembrar datos de prueba (cliente seed, subasta de ejemplo, etc.)
npm run seed

# 5. Levantar en modo desarrollo (recarga automática)
npm run dev
```

El servidor queda disponible en: **`http://localhost:8080`**

## Endpoints base

| Ruta | Descripción |
|------|-------------|
| `GET /health` | Health check (`{ status, uptime, timestamp }`) |
| `POST /v1/auth/register` | Registro etapa 1 (multipart) |
| `POST /v1/auth/activate` | Activación con token |
| `POST /v1/auth/login` | Login → JWT |
| `GET /v1/auth/me` | Usuario actual (requiere JWT) |
| `PATCH /v1/clients/:id` | Admitir cliente (requiere rol ADMIN) |

Base URL: `http://localhost:8080/v1`

## Credenciales seed (desarrollo)

El seed imprime en consola las credenciales del cliente de prueba. Por defecto:

- **DNI:** `30111222`
- **Password:** `Secret123!`
- **Categoría:** `gold`

## Nota sobre enums (SQLite)

SQLite no soporta `enum` nativo de Prisma ni tipo `Json`. En este proyecto:

- Los enums se modelan como `String` con comentarios `///` que listan los valores permitidos.
- Los campos JSON (ej. `AuctionEvent.data`, `Notification.payload`) se modelan como `String` y se serializan/deserializan en el servicio.

Al migrar a PostgreSQL (Entrega 3), se reemplazarán los campos `String` por sus tipos nativos sin cambios en la lógica de negocio.

## Estructura de carpetas

```
backend/
├── prisma/
│   ├── schema.prisma       # Modelo de datos (fuente de verdad DB)
│   └── seed.ts             # Datos iniciales para desarrollo
├── src/
│   ├── index.ts            # Entry point (arranca el servidor HTTP)
│   ├── app.ts              # Express app (sin listen, importable en tests)
│   ├── config/
│   │   └── env.ts          # Variables de entorno validadas con zod
│   ├── lib/
│   │   ├── prisma.ts       # Singleton de PrismaClient
│   │   ├── jwt.ts          # signToken / verifyToken
│   │   └── errors.ts       # AppError, ErrorCode, helpers
│   ├── middleware/
│   │   ├── auth.ts         # requireAuth, optionalAuth, requireRole, requireSelfOrAdmin
│   │   ├── error.ts        # Global error handler + notFound
│   │   └── validate.ts     # validate(schema) middleware zod
│   ├── routes/
│   │   └── index.ts        # Router v1 — monta módulos
│   └── modules/
│       ├── health/         # GET /health
│       │   └── health.routes.ts
│       ├── auth/           # POST /auth/register|activate|login + GET /auth/me
│       │   ├── auth.schema.ts
│       │   ├── auth.service.ts
│       │   ├── auth.controller.ts
│       │   └── auth.routes.ts
│       └── clients/        # PATCH /clients/:id (admisión)
│           └── clients.routes.ts
├── tests/
│   ├── health.test.ts
│   └── auth.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Cómo agregar un nuevo módulo

1. Crear `src/modules/<nombre>/` con: `<nombre>.schema.ts`, `<nombre>.service.ts`, `<nombre>.controller.ts`, `<nombre>.routes.ts`.
2. Montar el router en `src/routes/index.ts` (hay placeholders comentados).
3. Ver el módulo `auth` como referencia de estructura.
4. Escribir tests en `tests/<nombre>.test.ts`.

## Build para producción

```bash
npm run build
npm start
```

## Tests

```bash
npm test          # una pasada
npm run test:watch # modo watch (TDD)
```
