# AGENT.md — Livre Chatbot

## Criterio activo de entrega (prioridad máxima)

- Tratar el CRM como producto a entregar: recorrer todos los ítems de punta a punta (Operaciones, Visor de mapa, LIVI IA, Crear viaje, Gestión de viajes, Choferes, Vehículos, Propietarios, Clientes, Comisiones, Tarifa, Historial/cierres, Ajustes y temas claro/oscuro).
- Actuar como tester y corrector: investigar → editar → probar → volver a editar y probar hasta cerrar cada defecto visible o funcional. No pedir al usuario que descubra problemas que pueden verificarse aquí.
- Revisar especialmente legibilidad, tamaños, duplicaciones, espaciado, botones, formularios, tablas, estados vacíos/carga/error, responsive y contraste en light/dark.
- Validar en navegador autenticado cuando haga falta; si la sesión no está disponible, dejar explícito el límite y no afirmar que el flujo autenticado está listo.
- Antes de terminar: tests enfocados, `node --check js/app.js`, `git diff --check`, revisión visual de desktop/móvil y ambos temas, deploy verificado y fetch del asset publicado.
- Hacer cambios mínimos y aislados, separar visual de backend, no usar credenciales ni inventar datos/IDs, y commitear/pushear lo terminado. No incluir `.env.local`, `errores/` ni `.gitignore`.

## Contexto activo

- Frontend estático del panel LIVI / Viaja Livre.
- Entrada: `index.html`; lógica: `js/app.js`; estilos: `css/style.css`.
- El frontend y el backend CRM se publican únicamente en Railway.
- El frontend consume Livre Cloud; no llama directamente a proveedores externos ni mezcla la identidad del panel con la del pasajero de WhatsApp.

## Estado vigente (2026-10-29)

- El dashboard muestra las horas con la zona explícita `America/Argentina/Buenos_Aires`, sin depender de la configuración del navegador.
- El visor usa `Última actualización (Argentina)` y los popups muestran `Último dato (Argentina)`.
- El botón de actualización de Gestión de viajes (`#crm-refresh`) está conectado a `loadCrmData()`; `/crm/travels/live` responde correctamente.
- La creación y programación de viajes se resuelve en Livre Cloud: `date_programmed` se conserva, los programados quedan en `scheduled` y se liberan a `searching` al llegar la hora.
- El error de base posterior a confirmar un viaje se debía a que producción no tenía `livi_trips.scheduled_at`; la migración `20261029_scheduled_trips.sql` ya fue aplicada y registrada en producción.
- Pendiente real: probar un flujo completo autorizado de creación/programación. No se creó un viaje real durante las últimas verificaciones.

## Reglas de trabajo

- Investigar primero y hacer cambios mínimos, aislados y reversibles.
- No tocar contratos ni backend cuando el problema sea visual del frontend.
- No incluir credenciales, tokens ni respuestas sensibles.
- Mantener separadas las identidades del usuario del panel y del pasajero de WhatsApp.
- Ejecutar `node --check js/app.js`, los tests disponibles y `git diff --check` antes de publicar.
- Commitear y pushear los cambios terminados.
- No incluir ni exponer los cambios locales previos en `.env.local`, `errores/` o `.gitignore`.

## Reglas operativas del dashboard

- El estado `unavailable` o `out_of_service` no apaga el GPS del conductor; la app mantiene el GPS y esos estados sólo impiden nuevos ofrecimientos cuando corresponde.
- En Operaciones, tabla, contadores de filtros, KPIs y mapa deben usar la misma colección `snapshot.drivers`. No mezclar `driver_totals` globales con una lista parcial.
- El mapa debe recibir la colección filtrada: `TODOS` muestra todos los choferes con coordenadas válidas; cada estado muestra sólo ese estado. Una fila sin `lastPlace` no se dibuja para no mostrar una ubicación vieja como actual.
- Los KPIs de actividad se alimentan de `snapshot.activity` y distinguen viajes realizados, cancelados, pedidos de WhatsApp y pedidos CRM.

## Historial reciente

- La animación LED del composer tenía una regla final del tema oscuro que sobrescribía el gradiente con `background: var(--surface-0) !important`; la última regla aplicable debe preservar `conic-gradient` y `led-rotate`.
- La animación del borde fue reactivada para temas claro y oscuro.
- Se incrementó la versión del CSS en `index.html` para evitar caché del navegador.
- Cambio de zona horaria publicado en `75f3b44` (`fix: show dashboard times in Argentina`).
- Corrección backend relacionada publicada en `livre-cloud` con `9556b95` (`fix: persist and release scheduled trips`).

## Validaciones registradas

- `node --check js/app.js`: OK.
- Tests del proyecto CRM: 19 pasan en la validación anterior.
- Tests enfocados del backend de viajes/operaciones: 26 pasan.
- `git diff --check`: OK.

## Pendientes

- Validar visualmente el asset HTTPS si aparece una regresión de caché o deploy.
- Probar creación/programación sólo con autorización y operación controlada; no inventar viajes ni IDs.
- No afirmar que GPS, notificaciones o APK están validados físicamente desde este repositorio web.
