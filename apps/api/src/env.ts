function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Variável de ambiente obrigatória não definida: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? '0.0.0.0',
  // Fallback = cluster local criado por scripts/localdb.ps1.
  // Em Docker/Portainer a DATABASE_URL é sempre definida explicitamente.
  databaseUrl: required('DATABASE_URL', 'postgres://vedas@127.0.0.1:55432/vedas'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-nao-use-em-producao'),
  seedOnStart: (process.env.SEED_ON_START ?? 'true') === 'true',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@vedas.com.br',
  // Sem padrão de propósito: nenhuma senha de administrador vive no código.
  // A ausência só é um erro quando o primeiro admin precisa ser criado —
  // veja seedAdminUser() em src/db/seed.ts.
  adminPassword: process.env.ADMIN_PASSWORD ?? '',
  nfeEnvironment: (process.env.NFE_ENVIRONMENT ?? '2') as '1' | '2',
};
