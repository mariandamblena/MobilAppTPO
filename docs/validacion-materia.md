# subastita — Validación de conceptos de Desarrollo de Aplicaciones I

Fecha de revisión: 10 de septiembre de 2026.

**Resultado: cobertura parcial de la materia.** El proyecto demuestra una parte importante de la unidad de React Native: componentes, estado, eventos, navegación, formularios, consumo de API, sesión persistida y acceso a la galería. No demuestra todo el contenido de Android nativo, Compose/Material 3, IoT ni robótica. También faltan evidencias de investigación UX, pruebas en dispositivos y distribución de una versión instalable.

El programa analítico permite implementar el **trabajo integrador con Android Studio o React Native** (P, pág. 3). Por eso, usar Expo no invalida por sí solo el proyecto. Sin embargo, esa alternativa no sustituye las prácticas de Kotlin/Android ni acredita automáticamente todos los temas del cronograma. En `Contexto` no se identificó una consigna específica del TPO de subastas que permita certificar el cumplimiento de todos sus requisitos.

## Alcance y fuentes

Se revisaron los textos extraíbles de los 10 archivos de `../../Contexto`, la estructura del repositorio y las implementaciones relevantes del frontend y backend. Clase II está en PDF y PPTX: se considera una misma clase, sin sumar cobertura por duplicado. No se realizó una comparación visual con Figma ni una prueba en teléfono/emulador; las afirmaciones del README sobre entregas ya realizadas no se toman como evidencia de aprobación.

| Ref. | Material de Contexto | Conceptos utilizados en la revisión |
| --- | --- | --- |
| P | `PA-DESARROLLO DE APLICACIONES I.pdf`, págs. 2–3 y 5 | Unidades I, II y III; persistencia local/remota; interacción con otras apps; prácticas e integrador. |
| C | `DESARROLLO DE APLICACIONES I - Jueves Noche.pdf`, págs. 1–2 | Cronograma de **2C 2026**: Android, React Native, arquitectura, sensores, IoT, robótica, calidad y publicación. |
| I | `Clase I - DAI.pdf`, págs. 2–3, 11–23 y 32–33 | HCI, movilidad, recursos limitados, computación ubicua, arquitectura y sistemas ciberfísicos. |
| II | `Clase II - DAI.pdf` y `Clase II - DAI.pptx`, págs./diap. 5–18, 20–30 y 35–41 | Requerimientos, UI/UX, ciclo de desarrollo, pruebas y trazabilidad. |
| M | `Compose y Material3 (1).pptx`, diap. 2–13 | UI declarativa, recomposición, MaterialTheme, Column/Row/Box, Modifier, Scaffold y componentes. |
| D | `DiseñoDeApp - Aplicaciones Moviles (1).pptx`, diap. 3–12 | Usuarios, personas, viaje del usuario, wireframes, prototipos y diseño visual. |
| G | `Guia_Ejercicios_00 (1).pdf`, págs. 3–20 | 13 ejercicios de Android Studio, Kotlin, Compose, SDK, depuración y defensa del código. |
| A | `guia_IDE_Android_2026.pdf`, págs. 4–16 | IDE, Gradle, manifiesto, recursos, SDK, AVD, Logcat, debugger y red del emulador. |
| U | `UIUX_FUNDAMENTOS_V2U (1).pdf`, págs. 18–32, 39–88 | Design Thinking, investigación, Fitts, accesibilidad, adaptabilidad, Material Design y CX. |

El [README original del proyecto](../README.md) identifica el trabajo como **1C 2026**, mientras que C e I corresponden a **2C 2026**. El programa P indica vigencia desde 1C 2026. Se conserva esta diferencia: no se asume que el calendario de entregas del repositorio sea la consigna del segundo cuatrimestre.

Estados: **cubierto** significa que existe implementación concreta del concepto; **parcial** indica un alcance limitado o evidencia insuficiente; **sin evidencia** significa que no se encontró una implementación o un artefacto verificable en este repositorio. Ninguno de estos estados equivale a una calificación docente.

## Matriz de cobertura

| Concepto y fuente | Estado | Evidencia y límite |
| --- | --- | --- |
| Tipos de apps y selección tecnológica — P unidad I; C clase 1 | Parcial | [Stack del proyecto](../README.md) y [dependencias mobile](../mobile/package.json): React Native/Expo y salida web. Falta justificar la elección frente a Kotlin nativo, web responsive y PWA; una exportación web no acredita una PWA. |
| Limitaciones de pantalla, red y recursos — I; U págs. 39–44 | Parcial | [ScreenContainer](../mobile/src/components/ScreenContainer.tsx), [OfflineBanner](../mobile/src/components/OfflineBanner.tsx) y [usePolling](../mobile/src/hooks/usePolling.ts). Falta medir batería, memoria y comportamiento en redes inestables. |
| Problema, usuarios y requerimientos — II diap. 5–9; D diap. 5–6 | Parcial | El README define postores y consignantes, y el [contrato OpenAPI](../auctify-openapi.yaml) describe operaciones. Faltan historias con criterios de aceptación, restricciones no funcionales medibles y trazabilidad completa. |
| Personas, viaje del usuario, Design Thinking y CX — D; U págs. 24–32, 46–48 y 84–88 | Sin evidencia | Los perfiles funcionales no reemplazan entrevistas, personas, mapas de experiencia ni resultados de pruebas con usuarios. No se encontraron estos artefactos locales. |
| Wireframes, mockups y prototipos — D diap. 7–11; U págs. 18–23 | Parcial | Hay un enlace a Figma y referencias en el tema. No hay exportaciones locales que permitan verificar los flujos o su coincidencia con la app; el diseño externo no se validó. |
| Consistencia y jerarquía visual — U págs. 61–67 | Cubierto | [Tema compartido](../mobile/src/theme/index.ts), [AppBar](../mobile/src/components/AppBar.tsx), [Button](../mobile/src/components/Button.tsx) y [Field](../mobile/src/components/Field.tsx). La consistencia estructural es visible en el código; falta evaluación de usabilidad. |
| Fitts, legibilidad y accesibilidad — U págs. 42, 50–55 y 67 | Parcial | Botón principal de altura mínima 52 y atributos de accesibilidad en varios controles. Existen textos de 10–12 y controles sin etiqueta explícita. No se acreditaron contrastes, foco, lectores de pantalla ni tamaños de texto ampliados. |
| Diseño adaptable — C clase 2; U págs. 44, 73 y 82 | Parcial | Flexbox, safe areas y scroll. [app.json](../mobile/app.json) fija orientación vertical y desactiva soporte de tablet en iOS; [detalle de ítem](../mobile/app/item/%5Bid%5D.tsx) toma el ancho una vez con `Dimensions.get`. Falta una matriz de pruebas de tamaños. |
| JSX, TypeScript, funciones y componentes reutilizables — P unidad III; C clase 7 | Cubierto | Componentes funcionales con props tipadas, estilos y [tipos de API](../mobile/src/api/types.ts). |
| Estado, eventos y hooks — P unidad III; C clases 7 y 14 | Cubierto | `useState`, `useEffect`, `useCallback`, eventos de formularios y estado global en [AuthContext](../mobile/src/auth/AuthContext.tsx). |
| Stack, Tabs y parámetros — P práctica React Native; C clase 14 | Cubierto | [Stack raíz](../mobile/app/_layout.tsx), [Tabs](../mobile/app/%28tabs%29/_layout.tsx) y rutas con `useLocalSearchParams`. El código de Tabs utiliza tipos de React Navigation; Expo Router organiza las rutas. |
| Formularios y validación — C clases 4 y 14 | Cubierto | [Registro](../mobile/app/%28auth%29/register.tsx), [activación](../mobile/app/%28auth%29/activate.tsx), [Field](../mobile/src/components/Field.tsx) y [validación Zod del backend](../backend/src/modules/auth/auth.schema.ts). |
| REST, JSON y asincronía — P unidades II/III; C clases 6 y 13 | Cubierto | [Cliente API](../mobile/src/api/client.ts): `fetch`, promesas, JSON, multipart, JWT, timeout y errores. La implementación demuestra REST; no demuestra Retrofit ni una comparación conceptual REST/SOAP. |
| Estados de carga, error y ausencia de datos — C clase 6 | Cubierto | [Loading](../mobile/src/components/Loading.tsx), [ErrorView](../mobile/src/components/ErrorView.tsx), [EmptyState](../mobile/src/components/EmptyState.tsx) y reintentos en pantallas. |
| Persistencia remota y CRUD — P; C clase 6 | Cubierto como concepto | [Prisma/SQLite](../backend/prisma/schema.prisma) y servicios de productos, medios de pago y solicitudes. Para el teléfono, esta base está detrás de una API: es persistencia remota aunque el servidor corra en la misma PC. La instalación desde cero tiene un fallo de migraciones, detallado abajo. |
| Persistencia local en el dispositivo — P; C clases 6 y 14 | Parcial | [storage](../mobile/src/lib/storage.ts) guarda el JWT con SecureStore en móvil y localStorage en web. No hay CRUD local de artículos, borradores ni caché persistente de catálogo. SQLite del backend no acredita una base local del teléfono. |
| Acceso a recursos y permisos — P; C clases 8 y 13 | Parcial | Galería mediante `launchImageLibraryAsync` en registro y [fotos](../mobile/app/items/%5Bid%5D/photos.tsx). Configurar un texto de permiso de cámara no implica usarla: no se encontró `launchCameraAsync`, GPS ni acelerómetro. Falta verificar denegación/cancelación en dispositivos. |
| Interacción con otras aplicaciones — P contenidos mínimos; G ej. 12 | Cubierto en React Native | [Detalle de subasta](../mobile/app/auction-detail/%5Bid%5D.tsx) usa `Linking.openURL` y activación recibe un enlace profundo. No sustituye la práctica explícita de `Context`, `Intent.ACTION_SEND` y `ACTION_VIEW` en Kotlin. |
| Arquitectura, MVVM y Repository — I pág. 3; C clases 5–6 | Parcial | Backend separado en rutas, controladores y servicios; frontend con API, componentes, contexto y hooks. No hay una capa Repository propia ni ViewModels explícitos; varias pantallas consultan la API directamente. No corresponde presentar esta estructura como MVVM completo. |
| Máquinas de estado, sincronización y duplicados — C clases 11–12 | Parcial | [Subasta en vivo](../mobile/app/auction/%5Bid%5D.tsx) modela estados de conexión y deshabilita envíos en curso. [Pujas](../backend/src/modules/items/items.service.ts) usa transacción e idempotencia. Falta demostrar todos los escenarios de concurrencia y reconexión. |
| Seguridad de sesión y roles — C clases 11 y 15 | Cubierto a nivel básico | JWT, hash de contraseña, SecureStore en móvil, [middlewares de autorización](../backend/src/middleware/auth.ts) y controles de propiedad. Esto no constituye una auditoría de seguridad ni valida despliegue HTTPS. |
| Android Studio, Kotlin y Android SDK — P unidad II; C clases 3–6; A | Sin evidencia | No se encontró un proyecto propio con `.kt`, Activities, Fragments, XML, Gradle, manifiesto, RecyclerView o Retrofit. Ejecutar una app Expo en Android no demuestra haber programado esos elementos. |
| Compose y Material 3 — M; G | Sin implementación específica | JSX comparte la idea de UI declarativa y estado, pero no hay `@Composable`, `remember`, `@Preview`, `Modifier`, `Scaffold` ni `MaterialTheme`. El tema propio y los iconos no prueban uso de Material 3. |
| IoT, domótica, G1, ROS 2, DDS y MQTT — I pág. 3; C clases 10–12 | Sin evidencia | La app controla subastas mediante HTTP/polling. No hay robot, actuador, telemetría de sensores, middleware robótico, WebSocket ni MQTT. Son contenidos de la cursada cuya práctica debe acreditarse aparte si corresponde. |
| Pruebas unitarias, de integración, funcionales y UI — II; C clase 15 | Parcial | Hay [tests de backend](../backend/tests) y un [driver E2E](../backend/e2e/run.mjs). No se encontraron tests del frontend ni registros de pruebas de usabilidad, dispositivos o redes. Hay inconsistencias en tests de autenticación (ver hallazgos). |
| Construcción, distribución y publicación — II diap. 17–18; C clase 15 | Parcial | Backend compilable, TypeScript mobile válido y exportación web verificada. No se encontró APK/AAB, configuración EAS ni evidencia de instalación de un build propio. `assets` contiene instrucciones, pero no icono/splash de entrega. |

## Correspondencia con los 13 ejercicios de Android

La guía G es una práctica concreta de Kotlin/Compose. Las analogías siguientes sirven para estudiar y defender conceptos; **no equivalen a entregar los ejercicios**.

| Ejercicios de G (mapa en pág. 4) | Concepto demostrable en subastita | Evidencia nativa que falta |
| --- | --- | --- |
| 1: proyecto, AVD e IDE | Estructura mobile y comandos Expo documentados. | Proyecto Android, ejecución en AVD y recorrido de herramientas. |
| 2: composables y Preview | Funciones que renderizan componentes. | `@Composable` y `@Preview`. |
| 3–4: tipos, variables y funciones | TypeScript, props y componentes reutilizables. | Sintaxis, tipos, `val`, `var` y funciones Kotlin. |
| 5: layouts, Modifier y Material 3 | View, Flexbox y StyleSheet. | Column/Row/Box, Modifier y componentes Material 3. |
| 6–7: estado, eventos, entrada y null safety | Hooks, eventos, formularios y validación. | `remember`, estado Compose, `toIntOrNull` y tipos anulables Kotlin. |
| 8: cálculos, debugger y Logcat | Funciones de moneda y validación de importes. | Evidencia de breakpoint, inspección de variables y Logcat en Android Studio. |
| 9–10: modelos, listas y edición | Tipos TS, FlatList y operaciones de edición mediante API. | `data class`, colecciones Kotlin, LazyColumn y estado de colección Compose. |
| 11: recursos y configuración visual | Tema centralizado. | `strings.xml`, recursos Android y múltiples previews. |
| 12: Context e Intents | Abrir enlace externo. | Compartir texto con chooser y explicar Context/Intent/Uri en Kotlin. |
| 13: organizador de cursada | La app integra varios conceptos en otro dominio. | La miniapp específica, sus ocho requisitos y su defensa oral; subastas no reemplaza esa consigna. |

## Hallazgos que limitan la validación

1. **Desconexión puede borrar una sesión válida.** En [AuthContext](../mobile/src/auth/AuthContext.tsx), `hydrate` borra el token ante cualquier error de `/auth/me`, y `refreshMe` hace logout ante cualquier error. Un fallo de red puede tratarse como credencial inválida. Hay que distinguir errores de autenticación de problemas de conectividad antes de acreditar recuperación sin conexión.
2. **La pausa de polling requiere revisión.** En [usePolling](../mobile/src/hooks/usePolling.ts), los listeners de AppState y NetInfo escriben por separado sobre `activeRef.current`. No combinan ambas condiciones; al volver a primer plano pueden habilitar intentos sin red. El cleanup detiene el intervalo, pero no invalida las respuestas pendientes mediante el contador de solicitudes. Hace falta probar cambios de pantalla, segundo plano y reconexión.
3. **Accesibilidad incompleta.** [typography](../mobile/src/theme/typography.ts) define `overline: 11` y `caption: 12`; la home usa etiquetas de 10. En [Field](../mobile/src/components/Field.tsx), el Text del label no se vincula explícitamente al TextInput. Revisar tamaños táctiles, asociación de etiquetas, contraste y escalado antes de afirmar conformidad.
4. **Hay acciones todavía sin implementar.** [Login](../mobile/app/%28auth%29/login.tsx) muestra “Función próximamente disponible” para recuperar contraseña; [Perfil](../mobile/app/%28tabs%29/profile.tsx) hace lo mismo para editar perfil y configuración. Esto afecta completitud funcional y feedback al usuario.
5. **Las pruebas de integración no están alineadas con el login actual.** [inclusion-requests.test.ts](../backend/tests/inclusion-requests.test.ts) y [metrics-notifications.test.ts](../backend/tests/metrics-notifications.test.ts) envían `{ document, password }`, pero [loginSchema](../backend/src/modules/auth/auth.schema.ts) exige `{ email, password }`. Se comprobó que el esquema rechaza el primer formato. No se ejecutó la suite completa ni se afirma que pase.
6. **Las capacidades de demostración tienen límites.** Las notificaciones son registros consultados por API; no se encontró implementación push. El endpoint de streaming tiene una URL de ejemplo como fallback. No debe presentarse como integración validada con un proveedor de video ni como telemetría IoT.
7. **Falta documentación de decisiones y evidencias de entrega.** Hay referencias a F01–F11 y ADR en comentarios, pero `docs/features` solo contiene un README. El enlace a Figma requiere revisión aparte. Tampoco se encontró evidencia local de PostgreSQL desplegado, APK/AAB o evaluación en dispositivos.
8. **Las migraciones fallan al instalar desde cero.** Se ejecutó `prisma migrate deploy` sobre una base SQLite temporal vacía. Falló con **P3018: `table "Country" already exists`** en [20260608020508_](../backend/prisma/migrations/20260608020508_/migration.sql), porque [20260608010457_init](../backend/prisma/migrations/20260608010457_init/migration.sql) ya crea esa tabla. Es un problema previo al cambio de nombre. No se modificó el historial de migraciones ni ninguna base existente. Debe resolverse para acreditar una instalación reproducible.

## Prioridades para completar la evidencia académica

| Prioridad | Trabajo pendiente | Criterio verificable |
| --- | --- | --- |
| Alta | Alinear el alcance del TPO con el cronograma aplicable. | Dejar identificados los requisitos del integrador y las prácticas separadas de Android/IoT. No migrar toda la app solo por encontrar diapositivas de Compose. |
| Alta | Documentar requerimientos, decisiones y trazabilidad. | Cada flujo principal enlaza necesidad, criterio de aceptación, pantalla/API y prueba. Justificar React Native/Expo y el polling. |
| Alta | Resolver el historial de migraciones. | Crear una base vacía y aplicar todas las migraciones sin tablas duplicadas, conservando la compatibilidad con bases existentes. |
| Alta | Revisar sesión offline, polling y tests de autenticación. | Demostrar pérdida y retorno de red sin logout injustificado, pausa correcta en segundo plano y tests alineados con email. |
| Alta | Probar accesibilidad y pantallas reales. | Registrar controles con lector de pantalla, texto ampliado, teclado, pantallas pequeñas y al menos un teléfono Android. |
| Media | Ampliar persistencia local si se exige algo más que preferencias/sesión. | Un borrador de artículo o catálogo cacheado sobrevive al cierre y puede consultarse sin conexión. Las pujas deben seguir requiriendo confirmación del servidor. |
| Media | Completar recursos nativos y arquitectura según la consigna. | Si se exige cámara/GPS/sensores, demostrar su uso y permisos; si se exige Repository/MVVM, mostrar esas responsabilidades explícitamente. |
| Media | Preparar entrega instalable y defensa. | Build APK/AAB probado, iconos propios, guía de instalación, recorrido funcional y explicación del código. |
| Según práctica | Kotlin/Compose e IoT/robótica. | Entregables específicos o demostraciones separadas que acrediten los temas; no agregar hardware o permisos sin una necesidad de la consigna. |

## Cambio de nombre

El nombre visible pasa a ser **`subastita`** en login, splash, cabecera, menú, pantalla de seguro y textos demo del seed. También se actualizaron nombre/slug de Expo, mensajes de permisos, paquetes npm, título OpenAPI, logs y documentación.

El nuevo esquema principal es `subastita://`; se mantiene `auctify://` como alias para enlaces anteriores. Se conservan `com.auctify.mobile`, la clave de sesión `auctify_jwt`, las credenciales demo y referencias externas de Figma para no romper identidad de instalación, sesiones o enlaces existentes. El archivo del contrato conserva su ruta `auctify-openapi.yaml`. Esos identificadores históricos no son el nombre visible de la aplicación.

No se modificó la base existente: los nombres de registros demo ya guardados pueden conservar la marca anterior. El seed actualizado reconoce las ubicaciones anteriores y cambia su nombre sin crear otras subastas. Se verificó ese comportamiento exclusivamente en una base temporal. El nuevo nombre en una instalación nativa requiere reconstruir/reinstalar su build.

## Verificaciones realizadas

| Comprobación | Resultado |
| --- | --- |
| `backend`: `npm run build` | Correcto. |
| `mobile`: `node node_modules/typescript/bin/tsc --noEmit` | Correcto. |
| Configuración evaluada con `@expo/config` | `name` y `slug`: `subastita`; esquemas nuevo y anterior reconocidos. |
| `mobile`: `expo export --platform web` a directorio temporal | Correcto; bundle web generado. No acredita APK ni ejecución en teléfono. |
| `backend`: `npm test -- tests/health.test.ts` | **4/4 pruebas aprobadas**: health raíz, fecha ISO, health bajo `/v1` y respuesta 404. |
| Validación aislada de `loginSchema` compilado | DNI sin email: rechazado; email y contraseña: formato aceptado. No se consultó la base. |
| Migraciones sobre una base temporal vacía | **Falló** con P3018 en la segunda migración por tabla `Country` duplicada. |
| Seed sobre otra base temporal creada con `prisma db push --skip-generate` | Correcto. Se ejecutó, se simularon los cuatro nombres anteriores y se repitió: conservó las cuatro subastas, sus IDs y sus catálogos. Esta prueba valida el cambio de marca, no corrige ni valida el historial de migraciones. |

La evaluación funcional completa de subastas, las pruebas de UI y la validación en dispositivos quedan pendientes. El driver E2E existente reinicia y siembra la base: no se ejecutó sobre los datos locales para esta revisión.
