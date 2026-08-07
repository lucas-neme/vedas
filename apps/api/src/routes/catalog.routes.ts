import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { onlyDigits } from '../lib/br';
import { conflict, notFound } from '../lib/errors';
import { authenticate } from '../plugins/auth';

const optionalString = z.string().trim().default('');

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async () => {
    return db
      .selectFrom('categories')
      .leftJoin('products', 'products.category_id', 'categories.id')
      .select([
        'categories.id',
        'categories.name',
        'categories.description',
        'categories.active',
        sql<number>`count(products.id) filter (where products.active)`.as('products_count'),
      ])
      .groupBy(['categories.id', 'categories.name', 'categories.description', 'categories.active'])
      .orderBy('categories.name')
      .execute();
  });

  app.post('/', async (request, reply) => {
    const body = z
      .object({ name: z.string().trim().min(2), description: optionalString })
      .parse(request.body);

    const exists = await db
      .selectFrom('categories')
      .select('id')
      .where('name', '=', body.name)
      .executeTakeFirst();
    if (exists) throw conflict('Já existe uma categoria com este nome.');

    const row = await db.insertInto('categories').values(body).returningAll().executeTakeFirstOrThrow();
    return reply.code(201).send(row);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = z
      .object({
        name: z.string().trim().min(2),
        description: optionalString,
        active: z.boolean().default(true),
      })
      .parse(request.body);

    const row = await db
      .updateTable('categories')
      .set(body)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw notFound('Categoria');
    return row;
  });

  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const inUse = await db
      .selectFrom('products')
      .select('id')
      .where('category_id', '=', id)
      .executeTakeFirst();
    if (inUse) throw conflict('Categoria em uso por produtos. Desative-a em vez de excluir.');

    const deleted = await db
      .deleteFrom('categories')
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst();
    if (!deleted) throw notFound('Categoria');
    return { ok: true };
  });
}

export async function brandsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async () => {
    return db
      .selectFrom('brands')
      .leftJoin('products', 'products.brand_id', 'brands.id')
      .select([
        'brands.id',
        'brands.name',
        'brands.active',
        sql<number>`count(products.id) filter (where products.active)`.as('products_count'),
      ])
      .groupBy(['brands.id', 'brands.name', 'brands.active'])
      .orderBy('brands.name')
      .execute();
  });

  app.post('/', async (request, reply) => {
    const body = z.object({ name: z.string().trim().min(1) }).parse(request.body);
    const exists = await db
      .selectFrom('brands')
      .select('id')
      .where('name', '=', body.name)
      .executeTakeFirst();
    if (exists) throw conflict('Já existe uma marca com este nome.');
    const row = await db.insertInto('brands').values(body).returningAll().executeTakeFirstOrThrow();
    return reply.code(201).send(row);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = z
      .object({ name: z.string().trim().min(1), active: z.boolean().default(true) })
      .parse(request.body);
    const row = await db
      .updateTable('brands')
      .set(body)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw notFound('Marca');
    return row;
  });

  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const inUse = await db
      .selectFrom('products')
      .select('id')
      .where('brand_id', '=', id)
      .executeTakeFirst();
    if (inUse) throw conflict('Marca em uso por produtos. Desative-a em vez de excluir.');
    const deleted = await db.deleteFrom('brands').where('id', '=', id).returning('id').executeTakeFirst();
    if (!deleted) throw notFound('Marca');
    return { ok: true };
  });
}

const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do fornecedor.'),
  document: optionalString,
  contact_name: optionalString,
  email: z.union([z.string().email('E-mail inválido.'), z.literal('')]).default(''),
  phone: optionalString,
  zip_code: optionalString,
  street: optionalString,
  number: optionalString,
  district: optionalString,
  city: optionalString,
  state: optionalString,
  notes: optionalString,
  active: z.boolean().default(true),
});

export async function suppliersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const { search } = z.object({ search: z.string().trim().optional() }).parse(request.query);
    let query = db.selectFrom('suppliers').selectAll();
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      query = query.where((eb) =>
        eb.or([
          eb(sql<string>`lower(name)`, 'like', term),
          eb('document', 'like', `%${onlyDigits(search)}%`),
        ]),
      );
    }
    return query.orderBy('name').execute();
  });

  app.post('/', async (request, reply) => {
    const body = supplierSchema.parse(request.body);
    const row = await db
      .insertInto('suppliers')
      .values({ ...body, document: onlyDigits(body.document) })
      .returningAll()
      .executeTakeFirstOrThrow();
    return reply.code(201).send(row);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = supplierSchema.parse(request.body);
    const row = await db
      .updateTable('suppliers')
      .set({ ...body, document: onlyDigits(body.document) })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!row) throw notFound('Fornecedor');
    return row;
  });

  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const updated = await db
      .updateTable('suppliers')
      .set({ active: false })
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw notFound('Fornecedor');
    return { ok: true };
  });
}
