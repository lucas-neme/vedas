import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { isValidDocument, onlyDigits } from '../lib/br';
import { badRequest, conflict, notFound } from '../lib/errors';
import { paginated, paginationSchema } from '../lib/pagination';
import { authenticate } from '../plugins/auth';

const optionalString = z.string().trim().default('');
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).')
  .nullish()
  .transform((value) => value ?? null);

const customerSchema = z.object({
  person_type: z.enum(['PF', 'PJ']).default('PF'),
  name: z.string().trim().min(2, 'Informe o nome do cliente.'),
  trade_name: optionalString,
  document: optionalString,
  state_registration: optionalString,
  email: z.union([z.string().email('E-mail inválido.'), z.literal('')]).default(''),
  phone: optionalString,
  birth_date: optionalDate,
  zip_code: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  city_ibge_code: optionalString,
  state: optionalString,
  notes: optionalString,
  credit_limit: z.coerce.number().min(0).default(0),
  active: z.boolean().default(true),
});

const petSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do pet.'),
  species: z
    .enum(['cachorro', 'gato', 'ave', 'peixe', 'roedor', 'reptil', 'outro'])
    .default('cachorro'),
  breed: optionalString,
  size: z.enum(['mini', 'pequeno', 'medio', 'grande', 'gigante']).default('medio'),
  birth_date: optionalDate,
  weight_kg: z.coerce.number().min(0).nullish().transform((v) => v ?? null),
  neutered: z.boolean().default(false),
  food_product_id: z.coerce.number().int().nullish().transform((v) => v ?? null),
  daily_food_grams: z.coerce.number().min(0).nullish().transform((v) => v ?? null),
  notes: optionalString,
  active: z.boolean().default(true),
});

function normalizeDocument(document: string, personType: 'PF' | 'PJ'): string {
  const digits = onlyDigits(document);
  if (!digits) return '';
  if (!isValidDocument(digits)) {
    throw badRequest(personType === 'PF' ? 'CPF inválido.' : 'CNPJ inválido.');
  }
  return digits;
}

export async function customersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = paginationSchema
      .extend({
        search: z.string().trim().optional(),
        active: z.enum(['true', 'false', 'all']).default('true'),
      })
      .parse(request.query);

    let base = db.selectFrom('customers');
    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      const digits = onlyDigits(query.search);
      base = base.where((eb) =>
        eb.or([
          eb(sql<string>`lower(name)`, 'like', term),
          eb(sql<string>`lower(trade_name)`, 'like', term),
          eb(sql<string>`lower(email)`, 'like', term),
          ...(digits ? [eb('document', 'like', `%${digits}%`)] : []),
          ...(digits ? [eb(sql<string>`regexp_replace(phone, '\\D', '', 'g')`, 'like', `%${digits}%`)] : []),
        ]),
      );
    }
    if (query.active !== 'all') {
      base = base.where('active', '=', query.active === 'true');
    }

    const [rows, count] = await Promise.all([
      base
        .selectAll()
        .orderBy('name')
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .execute(),
      base.select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirst(),
    ]);

    const ids = rows.map((row) => row.id);
    const pets = ids.length
      ? await db
          .selectFrom('pets')
          .select(['id', 'customer_id', 'name', 'species'])
          .where('customer_id', 'in', ids)
          .where('active', '=', true)
          .execute()
      : [];

    const data = rows.map((row) => ({
      ...row,
      pets: pets.filter((pet) => pet.customer_id === row.id),
    }));

    return paginated(data, Number(count?.count ?? 0), query);
  });

  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const customer = await db
      .selectFrom('customers')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!customer) throw notFound('Cliente');

    const [pets, sales] = await Promise.all([
      db
        .selectFrom('pets')
        .leftJoin('products', 'products.id', 'pets.food_product_id')
        .select([
          'pets.id',
          'pets.customer_id',
          'pets.name',
          'pets.species',
          'pets.breed',
          'pets.size',
          'pets.birth_date',
          'pets.weight_kg',
          'pets.neutered',
          'pets.food_product_id',
          'pets.daily_food_grams',
          'pets.notes',
          'pets.active',
          'products.name as food_product_name',
          'products.package_weight_kg as food_package_weight_kg',
        ])
        .where('pets.customer_id', '=', id)
        .orderBy('pets.name')
        .execute(),
      db
        .selectFrom('sales')
        .select(['id', 'number', 'status', 'total', 'sold_at'])
        .where('customer_id', '=', id)
        .orderBy('sold_at', 'desc')
        .limit(20)
        .execute(),
    ]);

    const stats = await db
      .selectFrom('sales')
      .select(({ fn }) => [
        fn.count<number>('id').as('sales_count'),
        fn.sum<number>('total').as('total_spent'),
        fn.max('sold_at').as('last_purchase_at'),
      ])
      .where('customer_id', '=', id)
      .where('status', '=', 'confirmada')
      .executeTakeFirst();

    return {
      ...customer,
      pets,
      recentSales: sales,
      stats: {
        salesCount: Number(stats?.sales_count ?? 0),
        totalSpent: Number(stats?.total_spent ?? 0),
        lastPurchaseAt: stats?.last_purchase_at ?? null,
      },
    };
  });

  app.post('/', async (request, reply) => {
    const body = customerSchema.parse(request.body);
    const document = normalizeDocument(body.document, body.person_type);

    if (document) {
      const exists = await db
        .selectFrom('customers')
        .select('id')
        .where('document', '=', document)
        .executeTakeFirst();
      if (exists) throw conflict('Já existe um cliente com este CPF/CNPJ.');
    }

    const customer = await db
      .insertInto('customers')
      .values({ ...body, document })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(customer);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = customerSchema.parse(request.body);
    const document = normalizeDocument(body.document, body.person_type);

    if (document) {
      const exists = await db
        .selectFrom('customers')
        .select('id')
        .where('document', '=', document)
        .where('id', '!=', id)
        .executeTakeFirst();
      if (exists) throw conflict('Já existe outro cliente com este CPF/CNPJ.');
    }

    const customer = await db
      .updateTable('customers')
      .set({ ...body, document })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!customer) throw notFound('Cliente');
    return customer;
  });

  app.delete('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const updated = await db
      .updateTable('customers')
      .set({ active: false })
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw notFound('Cliente');
    return { ok: true };
  });

  // ── Pets ───────────────────────────────────────────────────────────────────
  app.post('/:id/pets', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = petSchema.parse(request.body);

    const customer = await db
      .selectFrom('customers')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!customer) throw notFound('Cliente');

    const pet = await db
      .insertInto('pets')
      .values({ ...body, customer_id: id })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(pet);
  });

  app.put('/:id/pets/:petId', async (request) => {
    const params = z
      .object({ id: z.coerce.number(), petId: z.coerce.number() })
      .parse(request.params);
    const body = petSchema.parse(request.body);

    const pet = await db
      .updateTable('pets')
      .set(body)
      .where('id', '=', params.petId)
      .where('customer_id', '=', params.id)
      .returningAll()
      .executeTakeFirst();

    if (!pet) throw notFound('Pet');
    return pet;
  });

  app.delete('/:id/pets/:petId', async (request) => {
    const params = z
      .object({ id: z.coerce.number(), petId: z.coerce.number() })
      .parse(request.params);

    const deleted = await db
      .deleteFrom('pets')
      .where('id', '=', params.petId)
      .where('customer_id', '=', params.id)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw notFound('Pet');
    return { ok: true };
  });
}
