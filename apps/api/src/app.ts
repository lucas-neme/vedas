import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { env } from './env';
import { AppError } from './lib/errors';
import { authRoutes } from './routes/auth.routes';
import { brandsRoutes, categoriesRoutes, suppliersRoutes } from './routes/catalog.routes';
import { customersRoutes } from './routes/customers.routes';
import { invoicesRoutes } from './routes/invoices.routes';
import { productsRoutes } from './routes/products.routes';
import { reportsRoutes } from './routes/reports.routes';
import { salesRoutes } from './routes/sales.routes';
import { publicRoutes, settingsRoutes } from './routes/settings.routes';
import { stockRoutes } from './routes/stock.routes';
import { usersRoutes } from './routes/users.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === 'production' ? 'info' : 'debug',
      transport:
        env.nodeEnv === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    },
    bodyLimit: 5 * 1024 * 1024,
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.jwtSecret });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(422).send({
        error: 'Dados inválidos.',
        issues: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: error.message, details: error.details });
    }

    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Erro interno do servidor.' });
    }

    return reply.code(statusCode).send({ error: (error as Error).message });
  });

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(publicRoutes, { prefix: '/api/public' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(customersRoutes, { prefix: '/api/customers' });
  await app.register(productsRoutes, { prefix: '/api/products' });
  await app.register(categoriesRoutes, { prefix: '/api/categories' });
  await app.register(brandsRoutes, { prefix: '/api/brands' });
  await app.register(suppliersRoutes, { prefix: '/api/suppliers' });
  await app.register(stockRoutes, { prefix: '/api/stock' });
  await app.register(salesRoutes, { prefix: '/api/sales' });
  await app.register(invoicesRoutes, { prefix: '/api/invoices' });
  await app.register(reportsRoutes, { prefix: '/api/reports' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });

  return app;
}
