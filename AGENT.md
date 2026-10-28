# AGENT.md — Livre Chatbot

## Contexto activo

- Frontend estático del panel LIVI / Viaja Livre.
- Entrada: `index.html`; lógica: `js/app.js`; estilos: `css/style.css`.
- El frontend se publica en Vercel y el backend CRM corre en Railway.

## Reglas de trabajo

- Investigar primero y hacer cambios mínimos, aislados y reversibles.
- No tocar contratos ni backend cuando el problema sea visual del frontend.
- No incluir credenciales, tokens ni respuestas sensibles.
- Mantener separadas las identidades del usuario del panel y del pasajero de WhatsApp.
- Ejecutar `node --check js/app.js`, los tests disponibles y `git diff --check` antes de publicar.
- Commitear y pushear los cambios terminados.

## Hallazgo visual reciente

La bandeja para escribir tiene una luz LED animada implementada con `conic-gradient`, `--led-angle` y `@keyframes led-rotate` en `css/style.css`. Una regla visual posterior la desactivaba con `animation: none` y otra regla del tema oscuro reemplazaba el gradiente por un fondo plano. Ambas reglas deben preservar la animación para que la luz recorra el borde de la bandeja.

## Validación reciente

- La animación del borde fue reactivada para temas claro y oscuro.
- Se incrementó la versión del CSS en `index.html` para evitar caché del navegador.
- Tests del proyecto: 19 pasan.
