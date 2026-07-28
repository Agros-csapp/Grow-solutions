const DEFAULT_DEV_JWT_SECRET = 'agros-development-only-secret-change-me';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? 'http://localhost:4173,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function requiredInProduction(name: string, value: string | undefined): string {
  if (process.env.NODE_ENV === 'production' && !value) {
    throw new Error(`${name} es obligatorio en producción`);
  }
  return value ?? '';
}

export const environment = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: requiredInProduction('JWT_SECRET', process.env.JWT_SECRET) || DEFAULT_DEV_JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  dbPath: process.env.AGROS_DB_PATH,
  seedAdmin: process.env.SEED_ADMIN !== 'false',
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@agros.local',
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Agros123!',
};

export function validateEnvironment(): void {
  if (!Number.isInteger(environment.port) || environment.port < 1 || environment.port > 65535) {
    throw new Error('PORT debe ser un entero entre 1 y 65535');
  }
  if (environment.nodeEnv === 'production' && environment.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
  }
  if (environment.seedAdmin && environment.seedAdminPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }
}
