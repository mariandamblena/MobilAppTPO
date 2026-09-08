# Assets

Este directorio debe contener los archivos de imagen referenciados en `app.json`:

| Archivo | Tamano recomendado | Fuente |
|---------|-------------------|--------|
| `icon.png` | 1024x1024 px | Exportar desde Figma `Auctify - DA1.fig` → frame "App Icon" |
| `splash.png` | 1242x2688 px (o 2048x2048 con padding) | Exportar desde Figma `Auctify - DA1.fig` → frame "Splash Screen" |

## Como exportar desde Figma

1. Abrir `Auctify - DA1.fig` en Figma.
2. Seleccionar el frame del icono / splash.
3. En el panel derecho → Export → PNG → tamanno indicado → Export.
4. Copiar los archivos a esta carpeta con los nombres exactos `icon.png` y `splash.png`.

## Nota importante

Expo **requiere** que estos archivos existan antes de `npx expo start --no-dev`.
Para desarrollo con `npx expo start` (Expo Go), los archivos de icono y splash
solo se usan al compilar el binario nativo; si no existen, Expo Go usa su propio icono
y la app arranca igual. Para la Entrega 3 (instalable en dispositivo), los archivos
**son obligatorios**.
