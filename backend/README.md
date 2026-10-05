# subastita Backend

API REST del sistema de subastas subastita. Construido con Node 24, Express 4, TypeScript 5, Prisma y SQLite.

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

## Autocompletar ficha desde una foto

`POST /v1/products/analyze-photo` recibe una foto por multipart (`photo`) con JWT
y devuelve `suggestions.catalogDescription`, `suggestions.fullDescription`,
`suggestions.pieceCount` (entero o `null`) y `suggestions.estimatedStartingPrice`
(número en **ARS** o `null`). No crea el producto ni guarda la imagen.
El usuario revisa la sugerencia y después guarda su borrador por el flujo habitual.

El precio sugerido es orientativo para iniciar una subasta, sin consultar precios
actuales ni certificar autoría, materiales o autenticidad. Si no se puede estimar,
queda vacío. El usuario puede corregirlo o quitarlo. `POST /products` y
`PATCH /products/:id` aceptan `estimatedStartingPrice` como número positivo de hasta
1.000.000.000, con hasta dos decimales, o `null`; omitirlo en un PATCH conserva el
valor anterior. Se guarda en el producto, siempre en ARS, y **no modifica** el precio
base aprobado del catálogo ni una propuesta de la empresa. La migración
`20261005160000_product_estimated_starting_price` agrega una columna opcional y
mantiene los artículos existentes sin estimación.

Agregar en el `.env` local del backend y reiniciar el servidor:

```dotenv
GEMINI_API_KEY=clave_privada_de_google_ai_studio
GEMINI_MODEL=gemini-3.5-flash-lite
```

También se admite `GOOGLE_API_KEY` si no se define `GEMINI_API_KEY`. La configuración
es opcional: sin clave la app sigue funcionando y el análisis responde 503 con un
mensaje para continuar manualmente. Nunca poner la clave en `mobile/.env`, variables
`EXPO_PUBLIC_*`, Git ni URLs. Los datos de la foto se envían a Gemini; revisar las
[condiciones del nivel gratuito](https://ai.google.dev/gemini-api/docs/pricing).

El endpoint valida JPEG/PNG/WebP, firma y tamaño (10 MiB), limita a 6 solicitudes por
minuto y una simultánea por usuario, y a 4 simultáneas por proceso. Espera hasta 40 s.
No deduce autoría, época, procedencia ni declaraciones legales. Los límites locales
son para este servidor de desarrollo; varias instancias requieren un limitador compartido.

Pruebas aisladas, sin base de datos ni consumo de la API:

```bash
npm test -- tests/photo-analysis.test.ts tests/products-price.test.ts
```

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
