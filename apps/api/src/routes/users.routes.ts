import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { conflict, notFound } from '../lib/errors';
import { authenticate, requireRole } from '../plugins/auth';

const userSchema = z.object({
  name: z.string().min(2, 'Informe o nome.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').optional(),
  role: z.enum(['admin', 'gerente', 'operador']).default('operador'),
  active: z.boolean().default(true),
});

export async function usersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireRole('admin'));

  app.get('/', async () => {
    return db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'active', 'created_at'])
      .orderBy('name')
      .execute();
  });

  app.post('/', async (request, reply) => {
    const body = userSchema.parse(request.body);
    if (!body.password) throw conflict('Informe uma senha para o novo usuário.');

    const email = body.email.toLowerCase().trim();
    const exists = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirst();
    if (exists) throw conflict('Já existe um usuário com este e-mail.');

    const user = await db
      .insertInto('users')
      .values({
        name: body.name,
        email,
        password_hash: bcrypt.hashSync(body.password, 10),
        role: body.role,
        active: body.active,
      })
      .returning(['id', 'name', 'email', 'role', 'active'])
      .executeTakeFirstOrThrow();

    return reply.code(201).send(user);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = userSchema.partial().parse(request.body);

    const updated = await db
      .updateTable('users')
      .set({
        ...(body.name ? { name: body.name } : {}),
        ...(body.email ? { email: body.email.toLowerCase().trim() } : {}),
        ...(body.role ? { role: body.role } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.password ? { password_hash: bcrypt.hashSync(body.password, 10) } : {}),
      })
      .where('id', '=', id)
      .returning(['id', 'name', 'email', 'role', 'active'])
      .executeTakeFirst();

    if (!updated) throw notFound('Usuário');
    return updated;
  });

  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    // usuários são desativados, nunca removidos (mantém histórico de vendas)
    const updated = await db
      .updateTable('users')
      .set({ active: false })
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw notFound('Usuário');
    return { ok: true };
  });
}
