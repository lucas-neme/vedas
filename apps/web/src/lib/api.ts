const TOKEN_KEY = 'vedas.token';

export class ApiError extends Error {
  readonly status: number;
  readonly issues?: Array<{ field: string; message: string }>;

  constructor(message: string, status: number, issues?: Array<{ field: string; message: string }>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  raw?: boolean;
};

export function buildQuery(query?: RequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStorage.get();

  const response = await fetch(`/api${path}${buildQuery(options.query)}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    tokenStorage.clear();
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError('Sessão expirada. Faça login novamente.', 401);
  }

  if (options.raw) {
    if (!response.ok) throw new ApiError('Falha ao baixar o arquivo.', response.status);
    return (await response.text()) as T;
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload?.error ??
      payload?.message ??
      `Erro ${response.status} ao comunicar com o servidor.`;
    throw new ApiError(message, response.status, payload?.issues);
  }

  return payload as T;
}

export type Paginated<T> = {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
};
