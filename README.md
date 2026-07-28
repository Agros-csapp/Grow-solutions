# Grow Solutions 0.5.0-alpha.7

MVP ejecutable para gestión de UPI, captura agronómica, decisiones, procesos, protocolos, evidencias, Timeline, Mission Control, Mi Día y simulación hídrica.

## Requisitos

- Node.js 22+
- npm 10+

## Instalación

```bash
npm install
npm run check
```

## Ejecución

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs

## Usuario local

- Correo: `admin@grow.local`
- Contraseña: `Agros123!`

## Datos

Por defecto el backend crea una base SQLite local en `apps/api/data/agros.db`. Para usar otra ubicación:

```bash
AGROS_DB_PATH=/ruta/agros.db npm run dev:api
```

## Comandos

```bash
npm run build
npm run test
npm run check
```

## Nota de seguridad

Las credenciales incluidas son solo para desarrollo local. Deben cambiarse antes de cualquier piloto conectado a red.
