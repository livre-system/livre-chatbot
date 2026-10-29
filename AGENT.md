# AGENT.md — Livre Chatbot

## Contexto activo

- Frontend estático del panel LIVI / Viaja Livre.
- Entrada: `index.html`; lógica: `js/app.js`; estilos: `css/style.css`.
- El frontend y el backend CRM se publican únicamente en Railway.

## Reglas de trabajo

- Investigar primero y hacer cambios mínimos, aislados y reversibles.
- No tocar contratos ni backend cuando el problema sea visual del frontend.
- No incluir credenciales, tokens ni respuestas sensibles.
- Mantener separadas las identidades del usuario del panel y del pasajero de WhatsApp.
- Ejecutar `node --check js/app.js`, los tests disponibles y `git diff --check` antes de publicar.
- Commitear y pushear los cambios terminados.

## Hallazgo visual reciente

La animación LED del composer también tenía una segunda regla al final del CSS del tema oscuro que sobrescribía el gradiente con `background: var(--surface-0) !important`. La corrección debe preservar el `conic-gradient` y `led-rotate` en la última regla aplicable.

## Hallazgo operativo reciente

- El estado `unavailable` o `out_of_service` no apaga el GPS del conductor; la app mantiene el GPS y esos estados sólo impiden nuevos ofrecimientos cuando corresponde.
- En Operaciones, tabla, contadores de filtros, KPIs y mapa deben usar la misma colección `snapshot.drivers`. No se deben mezclar `driver_totals` globales con una lista parcial.
- El mapa debe recibir la colección filtrada: `TODOS` muestra todos los choferes con coordenadas válidas; cada estado muestra sólo ese estado. Una fila sin `lastPlace` no se dibuja para no mostrar una ubicación vieja como actual.
- Los KPIs de actividad se alimentan de `snapshot.activity` y distinguen viajes realizados, cancelados, pedidos de WhatsApp y pedidos CRM.

## Validación reciente

- La animación del borde fue reactivada para temas claro y oscuro.
- Se incrementó la versión del CSS en `index.html` para evitar caché del navegador.
- Tests del proyecto: 19 pasan.
