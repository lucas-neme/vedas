import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { unauthorized } from '../lib/errors';
import { authenticate, type AuthUser } from '../plugins/auth';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', async (request) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email.toLowerCase().trim())
      .executeTakeFirst();

    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
      throw unauthorized('E-mail ou senha inválidos.');
    }

    const payload: AuthUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = app.jwt.sign(payload, { expiresIn: '12h' });
    return { token, user: payload };
  });

  app.get('/me', { preHandler: authenticate }, async (request) => {
    const auth = request.user as AuthUser;
    const user = await db
      .selectFrom('users')
      .select(['id', 'name', 'email', 'role', 'active'])
      .where('id', '=', auth.id)
      .executeTakeFirst();

    if (!user || !user.active) throw unauthorized();
    return user;
  });

  app.post('/change-password', { preHandler: authenticate }, async (request) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres.'),
      })
      .parse(request.body);

    const auth = request.user as AuthUser;
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', auth.id)
      .executeTakeFirst();

    if (!user || !bcrypt.compareSync(body.currentPassword, user.password_hash)) {
      throw unauthorized('Senha atual incorreta.');
    }

    await db
      .updateTable('users')
      .set({ password_hash: bcrypt.hashSync(body.newPassword, 10) })
      .where('id', '=', auth.id)
      .execute();

    return { ok: true };
  });
}
