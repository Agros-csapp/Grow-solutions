# Implementación 01 — estabilización del MVP

Versión: 0.5.0-alpha.8

Cambios aplicados directamente al código:

- Validación estricta de variables de entorno.
- JWT obligatorio y de mínimo 32 caracteres en producción.
- CORS restringido por `CORS_ORIGINS`.
- Filtro global de excepciones sin exposición de detalles internos.
- Validación de DTO con rechazo de campos no permitidos.
- Usuario administrador inicial configurable por entorno.
- Contraseñas normalizadas y hash bcrypt con coste 12.
- Persistencia SQLite montada como volumen Docker.
- Contenedores con `npm ci`; API ejecutada como usuario no root.
- URL del backend inyectable al compilar el frontend.

## Ejecución

1. Copiar `.env.example` a `.env`.
2. Cambiar `JWT_SECRET` y `SEED_ADMIN_PASSWORD`.
3. Ejecutar `npm install` y `npm run check`.
4. Ejecutar `docker compose up --build`.

## Alcance pendiente

La migración completa desde SQLite a Prisma/PostgreSQL no forma parte de este parche. Debe realizarse como intervención separada para evitar una sustitución incompleta del repositorio actual.
