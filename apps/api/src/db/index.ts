import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../env';
import type { Database } from './types';

// numeric/decimal chegam como string por padrão no driver pg; para um CRM
// com valores monetários pequenos, number é mais prático em toda a API.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));
// DATE deve permanecer como 'YYYY-MM-DD' (sem fuso).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export async function waitForDatabase(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (error) {
      if (attempt === retries) throw error;
      // eslint-disable-next-line no-console
      console.log(`[db] aguardando Postgres... (${attempt}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
