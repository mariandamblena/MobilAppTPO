# Auctify Mobile

App mobile del sistema de subastas Auctify (TPO DAI — 1C2026 · Grupo 03).
Construida con **Expo + expo-router + TypeScript**.

## Prerequisitos

- Node.js 18+
- [Expo Go](https://expo.dev/client) en el dispositivo fisico **o** emulador Android/iOS
- Backend corriendo (ver `backend/`)

## Setup

```bash
# Desde la carpeta mobile/
npm install
cp .env.example .env
# Editar .env si el backend no corre en localhost (ver nota abajo)
npx expo start
```

Escanear el QR con Expo Go (Android) o la app de Camara (iOS).

## Apuntar al backend

La variable `EXPO_PUBLIC_API_URL` en `.env` define la URL base de la API.

- **Emulador Android:** `http://10.0.2.2:8080/v1`
- **Emulador iOS:** `http://localhost:8080/v1`
- **Dispositivo fisico (red LAN):** usar la IP LAN de la maquina donde corre el backend,
  por ejemplo `http://192.168.1.100:8080/v1`. `localhost` NO funciona en dispositivos fisicos.

## Estructura de carpetas

```
mobile/
├── app/                     # Rutas (expo-router, file-based)
│   ├── _layout.tsx          # Root: AuthProvider + SafeAreaProvider + offline banner
│   ├── index.tsx            # Bootstrap: hidrata auth y redirige
│   ├── (auth)/              # Grupo sin tabs: login, registro, pendiente, activacion
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── pending.tsx
│   │   └── activate.tsx
│   ├── (tabs)/              # Grupo con bottom tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx        # Subastas
│   │   ├── items.tsx        # Mis articulos
│   │   ├── metrics.tsx      # Metricas
│   │   ├── notifications.tsx
│   │   └── profile.tsx
│   └── auction/
│       └── [id].tsx         # Subasta en vivo (polling + pujas)
├── src/
│   ├── api/
│   │   ├── client.ts        # Fetch wrapper tipado con JWT, timeout, error parsing
│   │   └── types.ts         # Tipos TS de los schemas MVP del OpenAPI
│   ├── auth/
│   │   └── AuthContext.tsx  # Context: user, login, register, activate, logout
│   ├── components/          # Componentes reutilizables
│   │   ├── Button.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorView.tsx
│   │   ├── Field.tsx
│   │   ├── Loading.tsx
│   │   ├── OfflineBanner.tsx
│   │   └── ScreenContainer.tsx
│   ├── hooks/
│   │   └── usePolling.ts    # Hook de polling para live-status
│   └── theme/
│       ├── colors.ts        # Paleta Auctify
│       ├── typography.ts    # Escala tipografica legible (body >= 15-16)
│       └── index.ts
└── assets/
    └── README.md            # Instrucciones para exportar icon.png y splash.png desde Figma
```

## Diseno y Figma

Los tokens exactos de color, tipografia y espaciado deben sincronizarse con el archivo
**`Auctify - DA1.fig`** entregado en la Entrega 1.

Los archivos en `src/theme/` contienen valores **placeholder** claramente marcados con
`// TODO: sync exact values from Figma Auctify - DA1.fig`.

### Legibilidad de fuentes (correccion de la catedra)

Las pantallas de alta fidelidad de la Entrega 1 fueron corregidas por exceso de contenido
y riesgo de fuentes pequenas. Por ello, **el tema impone un minimo de 15px para cuerpo de
texto y jamas baja de 13px** en ningun elemento. Ver `src/theme/typography.ts`.
