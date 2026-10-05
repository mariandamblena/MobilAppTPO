# subastita Mobile

App mobile del sistema de subastas subastita (TPO DAI — 1C2026 · Grupo 03).
Construida con **Expo + expo-router + TypeScript**.

El nombre visible y el slug de Expo son `subastita`. Los enlaces nuevos usan
`subastita://`; el esquema anterior sigue admitido. El identificador nativo
`com.auctify.mobile` y la clave de sesión se conservan para mantener compatibilidad.
El nombre del archivo de Figma sigue siendo el de la referencia original.

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
│       ├── colors.ts        # Paleta subastita
│       ├── typography.ts    # Escala tipografica legible (body >= 15-16)
│       └── index.ts
└── assets/
    └── README.md            # Instrucciones para exportar icon.png y splash.png desde Figma
```

## Ficha sugerida desde una foto

En **Vender → Nuevo artículo**, se puede tomar o adjuntar una imagen JPEG, PNG o
WebP de hasta 10 MB antes de crear el borrador. La app pide al backend una sugerencia
de título para el catálogo, descripción y cantidad de piezas. Los campos siguen
siendo editables; las respuestas no reemplazan datos que el usuario haya escrito.
Autoría, época, procedencia y declaraciones se completan manualmente.

El análisis usa `POST /products/analyze-photo`. La configuración de Gemini está en
`backend/.env` (ver `backend/README.md`); ninguna clave va en `EXPO_PUBLIC_*`.
Si el servicio no está disponible, se puede reintentar o continuar con carga manual.
Al guardar, la foto seleccionada se adjunta al producto y cuenta entre las seis
imágenes requeridas por el flujo de inclusión existente.

## Diseno y Figma

Los tokens exactos de color, tipografia y espaciado deben sincronizarse con el archivo
**[Subastita - DA1](https://www.figma.com/design/fv2HV2LNqdIZHDMi0PiAiM/Subastita---DA1)**.

Los archivos en `src/theme/` centralizan los tokens de color, tipografía, espaciado
y sombras. Sus comentarios indican procedencia de Figma; la coincidencia visual
con el archivo original debe comprobarse al revisar el diseño.

### Legibilidad de fuentes (correccion de la catedra)

Las pantallas de alta fidelidad de la Entrega 1 fueron corregidas por exceso de contenido
y riesgo de fuentes pequenas. Actualmente el tema usa cuerpo de 16, cuerpo pequeño
de 14, etiquetas de 14, captions de 12 y overlines de 11; algunas pantallas usan
etiquetas de 10. La legibilidad y el escalado requieren validación en dispositivos.
Ver `src/theme/typography.ts` y la [revisión de accesibilidad](../docs/validacion-materia.md).
