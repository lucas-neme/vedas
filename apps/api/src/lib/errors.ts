export class AppError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const notFound = (what: string) => new AppError(`${what} não encontrado(a).`, 404);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(message, 400, details);
export const conflict = (message: string) => new AppError(message, 409);
export const unauthorized = (message = 'Não autorizado.') => new AppError(message, 401);
export const forbidden = (message = 'Acesso negado.') => new AppError(message, 403);
