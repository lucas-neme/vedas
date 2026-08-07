import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../lib/errors';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'gerente' | 'operador';
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthUser;
    user: AuthUser;
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized('Sessão expirada ou token inválido.');
  }
}

/** preHandler que exige um dos papéis informados. Usar depois de `authenticate`. */
export function requireRole(...roles: Array<AuthUser['role']>) {
  return async (request: FastifyRequest): Promise<void> => {
    const user = request.user as AuthUser | undefined;
    if (!user) throw unauthorized();
    if (!roles.includes(user.role)) {
      throw forbidden('Seu perfil não tem permissão para esta operação.');
    }
  };
}
