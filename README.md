# Livre Chatbot

Frontend del panel LIVI / Viaja Livre.

## Arquitectura

- Aplicación web estática en `index.html`.
- Lógica principal en `js/app.js`.
- Estilos en `css/style.css`.
- Deploy frontend: Vercel.
- Backend CRM: FastAPI en Railway.

## Funcionalidades actuales

- Login y registro propios; no usa Google OAuth.
- Chat LIVI y formulario de creación de viajes.
- Panel CRM con vistas separadas para:
  - Control operacional.
  - Viajes.
  - Choferes.
  - Vehículos.
- Filtros y búsquedas conectados a los endpoints CRM.
- Tabla genérica separada de las vistas específicas.
- Vehículos: listado paginado de 20 registros por página.
- La vista de Vehículos limpia y oculta la tabla genérica para evitar duplicaciones.

## Desarrollo local

Servir el directorio con cualquier servidor HTTP estático, por ejemplo:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080`.

## Validaciones

```bash
node --check js/app.js
git diff --check
```

## Reglas del proyecto

- No incluir credenciales, tokens ni respuestas sensibles.
- Investigar antes de modificar contratos o endpoints.
- Mantener separadas las identidades del usuario del panel y del pasajero de WhatsApp.
- Hacer cambios mínimos y aislados.
