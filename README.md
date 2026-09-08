# Auctify — Grupo 03

**TPO DAI · 1C 2026** — Juan Ignacio Molina · Joaquín Villamediana · Valentino Femia

Auctify es una **app móvil de subastas en vivo** para una casa de remates de Buenos Aires. Dos perfiles
conviven en la misma app: **postores**, que se registran, cargan un medio de pago y **pujan en vivo** sobre
ítems de un catálogo; y **dueños/consignantes**, que **proponen artículos**, los envían al depósito y cobran
una vez rematados. El comportamiento refleja el relevamiento (categorías de usuario, topes de puja, multas
del 10% por default, póliza de seguro, una sola subasta activa por usuario a la vez).

🎨 **Diseño (Figma):** https://www.figma.com/design/jAhnt4cbFjnNdgULvkhfzU/Auctify---DA1

> Este repo es un **monorepo**: backend + app mobile + contrato OpenAPI.
> La trazabilidad con el diseño es obligatoria (lo entregado debe coincidir con lo diseñado).

---

## Estructura

```
auctify-desa-1/
├── auctify-openapi.yaml   # Contrato de la API REST (fuente de verdad front↔back)
├── backend/               # Node + Express + TypeScript + Prisma (SQLite en dev)
└── mobile/                # Expo (React Native) + expo-router + TypeScript
```

## Stack

| | |
|---|---|
| **Mobile** | Expo (React Native), TypeScript, expo-router, expo-secure-store |
| **Backend** | Node + Express + TypeScript, Prisma, zod, JWT |
| **DB** | SQLite (dev) → PostgreSQL (producción, Entrega 3) |
| **Contrato** | OpenAPI 3.0 (`auctify-openapi.yaml`), base `http://localhost:8080/v1` |

---

## Quick start

> Requisitos: Node 20+ (probado en 24), npm, y la app **Expo Go** en tu celular (o un emulador).

### 1) Backend
```bash
cd backend
npm install
cp .env.example .env
npm run prisma:migrate   # crea la base SQLite
npm run seed             # datos de prueba (imprime credenciales)
npm run dev              # http://localhost:8080/v1  (health: /health)
```

### 2) Mobile
```bash
cd mobile
npm install
cp .env.example .env     # setear EXPO_PUBLIC_API_URL
npx expo start
```
> En un **dispositivo físico**, `EXPO_PUBLIC_API_URL` debe apuntar a la **IP LAN** de tu compu
> (ej. `http://192.168.0.10:8080/v1`), no a `localhost`.

## Entregas

- **E1 (hecha):** maquetado, wireframes, paleta, Figma, ícono/splash, OpenAPI.
- **E2:** back + front al 50%, **un circuito completo integrado** (login → subasta → conectarse → pujar) y
  manejo de errores.
- **E3:** app completa, backend online (PostgreSQL), frontend instalable en un dispositivo.
