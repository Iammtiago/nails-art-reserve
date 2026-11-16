// Environment access, read on every call so tests and serverless cold starts see current values.

export function env() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    mongoUri: (process.env.MONGODB_URI || '').trim(),
    sessionSecret: process.env.ADMIN_SESSION_SECRET || '',
    appUrl: (process.env.APP_URL || '').trim().replace(/\/+$/, ''),
    corsOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    apiPort: Number(process.env.API_PORT) || 4000,
    rateLimitsEnabled: nodeEnv !== 'test' || process.env.ENFORCE_RATE_LIMIT === '1',
  };
}

export const SESSION_SECRET_MIN_LENGTH = 32;
