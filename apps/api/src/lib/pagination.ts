import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginated<T>(data: T[], total: number, { page, perPage }: Pagination) {
  return {
    data,
    meta: {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
