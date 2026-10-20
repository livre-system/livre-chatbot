# AGENT.md — Livre Chatbot / CRM

## Contexto operativo

- `livre-chatbot` es el frontend web del CRM y debe ejecutarse y desplegarse únicamente en Railway.
- URL operativa de producción: `https://livre-chatbot-production.up.railway.app/`.
- El backend central es `livre-cloud`, desplegado en Railway: `https://livre-cloud-production.up.railway.app/`.
- Railway es la única fuente válida para revisar disponibilidad, deployments, logs y estado de producción.
- Vercel ya no forma parte del stack de Livre. No usar, publicar, verificar ni tomar como referencia ningún alias o deployment de Vercel salvo pedido explícito del usuario.
- Un error o `503` de un alias histórico de Vercel no representa una falla de Livre.

## Reglas de trabajo

- Investigar primero el flujo y el contrato real antes de editar.
- Hacer cambios mínimos, aislados y reversibles; no tocar backend ni otros flujos cuando el pedido sea sólo del CRM.
- No exponer credenciales, tokens ni valores de variables de entorno.
- Ejecutar las validaciones del CRM antes de publicar.
- Publicar cambios autorizados en `origin/main` y verificar el deployment correspondiente en Railway.
- No incluir `.env.local` ni otros archivos con secretos en commits.

## Visor de mapas

- El visor debe mostrar únicamente posiciones con `sessionActive === true`.
- No reutilizar posiciones históricas de cuentas o sesiones antiguas como si fueran ubicaciones actuales.
- Los cambios en el visor no deben alterar el tracking, los endpoints ni la lógica de autenticación salvo que el pedido lo requiera explícitamente.
