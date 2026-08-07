import { buildApp } from './app';
import { db, waitForDatabase } from './db';
import { runMigrations } from './db/migrator';
import { seedDatabase } from './db/seed';
import { env } from './env';

async function main(): Promise<void> {
  await waitForDatabase();
  await runMigrations();

  if (env.seedOnStart) {
    await seedDatabase();
  }

  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`recebido ${signal}, encerrando...`);
    await app.close();
    await db.destroy();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: env.port, host: env.host });
  app.log.info(`Vedas API pronta em http://${env.host}:${env.port}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[fatal] falha ao iniciar a API:', error);
  process.exit(1);
});
