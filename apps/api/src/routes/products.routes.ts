import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { conflict, notFound } from '../lib/errors';
import { paginated, paginationSchema } from '../lib/pagination';
import { authenticate, requireRole } from '../plugins/auth';

const optionalString = z.string().trim().default('');
const nullableNumber = z.coerce.number().nullish().transform((v) => (v === undefined ? null : v));

const productSchema = z.object({
  sku: z.string().trim().min(1, 'Informe o SKU / código interno.'),
  barcode: z.string().trim().nullish().transform((v) => (v ? v : null)),
  name: z.string().trim().min(2, 'Informe o nome do produto.'),
  description: optionalString,
  category_id: nullableNumber,
  brand_id: nullableNumber,
  supplier_id: nullableNumber,
  species: z
    .enum(['cachorro', 'gato', 'ave', 'peixe', 'roedor', 'reptil', 'geral'])
    .default('geral'),
  life_stage: z.enum(['filhote', 'adulto', 'senior', 'todos']).default('todos'),
  package_weight_kg: nullableNumber,
  unit: z.string().trim().default('UN'),
  requires_batch: z.boolean().default(true),
  cost_price: z.coerce.number().min(0).default(0),
  sale_price: z.coerce.number().min(0).default(0),
  min_stock: z.coerce.number().min(0).default(0),
  max_stock: z.coerce.number().min(0).default(0),
  ncm: optionalString,
  cest: optionalString,
  cfop: optionalString,
  origin: z.string().trim().default('0'),
  csosn: optionalString,
  cst_icms: optionalString,
  icms_rate: z.coerce.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
});

const productSelect = [
  'products.id',
  'products.sku',
  'products.barcode',
  'products.name',
  'products.description',
  'products.category_id',
  'products.brand_id',
  'products.supplier_id',
  'products.species',
  'products.life_stage',
  'products.package_weight_kg',
  'products.unit',
  'products.requires_batch',
  'products.cost_price',
  'products.sale_price',
  'products.stock_qty',
  'products.min_stock',
  'products.max_stock',
  'products.ncm',
  'products.cest',
  'products.cfop',
  'products.origin',
  'products.csosn',
  'products.cst_icms',
  'products.icms_rate',
  'products.active',
  'products.created_at',
  'products.updated_at',
] as const;

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = paginationSchema
      .extend({
        search: z.string().trim().optional(),
        categoryId: z.coerce.number().optional(),
        brandId: z.coerce.number().optional(),
        species: z.string().optional(),
        active: z.enum(['true', 'false', 'all']).default('true'),
        lowStock: z.enum(['true', 'false']).default('false'),
        orderBy: z.enum(['name', 'stock', 'price', 'created']).default('name'),
      })
      .parse(request.query);

    let base = db.selectFrom('products');

    if (query.search) {
      const term = `%${query.search.toLowerCase()}%`;
      base = base.where((eb) =>
        eb.or([
          eb(sql<string>`lower(products.name)`, 'like', term),
          eb(sql<string>`lower(products.sku)`, 'like', term),
          eb('products.barcode', 'like', `%${query.search}%`),
        ]),
      );
    }
    if (query.categoryId) base = base.where('products.category_id', '=', query.categoryId);
    if (query.brandId) base = base.where('products.brand_id', '=', query.brandId);
    if (query.species) base = base.where('products.species', '=', query.species as never);
    if (query.active !== 'all') base = base.where('products.active', '=', query.active === 'true');
    if (query.lowStock === 'true') {
      base = base.where(sql<boolean>`products.stock_qty <= products.min_stock`);
    }

    const orderColumn = {
      name: 'products.name',
      stock: 'products.stock_qty',
      price: 'products.sale_price',
      created: 'products.created_at',
    }[query.orderBy] as 'products.name';

    const [rows, count] = await Promise.all([
      base
        .leftJoin('categories', 'categories.id', 'products.category_id')
        .leftJoin('brands', 'brands.id', 'products.brand_id')
        .select([...productSelect, 'categories.name as category_name', 'brands.name as brand_name'])
        .orderBy(orderColumn, query.orderBy === 'name' ? 'asc' : 'desc')
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .execute(),
      base.select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirst(),
    ]);

    return paginated(rows, Number(count?.count ?? 0), query);
  });

  /** Busca rápida usada pelo PDV (nome, SKU ou leitura de código de barras). */
  app.get('/search', async (request) => {
    const { q, limit } = z
      .object({ q: z.string().trim().default(''), limit: z.coerce.number().min(1).max(50).default(15) })
      .parse(request.query);

    if (!q) return [];
    const term = `%${q.toLowerCase()}%`;

    return db
      .selectFrom('products')
      .leftJoin('brands', 'brands.id', 'products.brand_id')
      .select([
        'products.id',
        'products.sku',
        'products.barcode',
        'products.name',
        'products.unit',
        'products.sale_price',
        'products.stock_qty',
        'products.requires_batch',
        'products.package_weight_kg',
        'brands.name as brand_name',
      ])
      .where('products.active', '=', true)
      .where((eb) =>
        eb.or([
          eb(sql<string>`lower(products.name)`, 'like', term),
          eb(sql<string>`lower(products.sku)`, 'like', term),
          eb('products.barcode', '=', q),
        ]),
      )
      .orderBy(sql`case when products.barcode = ${q} then 0 else 1 end`)
      .orderBy('products.name')
      .limit(limit)
      .execute();
  });

  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const product = await db
      .selectFrom('products')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .leftJoin('brands', 'brands.id', 'products.brand_id')
      .leftJoin('suppliers', 'suppliers.id', 'products.supplier_id')
      .select([
        ...productSelect,
        'categories.name as category_name',
        'brands.name as brand_name',
        'suppliers.name as supplier_name',
      ])
      .where('products.id', '=', id)
      .executeTakeFirst();

    if (!product) throw notFound('Produto');

    const [batches, movements] = await Promise.all([
      db
        .selectFrom('product_batches')
        .selectAll()
        .where('product_id', '=', id)
        .orderBy('expires_at', sql`asc nulls last`)
        .execute(),
      db
        .selectFrom('stock_movements')
        .leftJoin('users', 'users.id', 'stock_movements.user_id')
        .select([
          'stock_movements.id',
          'stock_movements.type',
          'stock_movements.qty',
          'stock_movements.unit_cost',
          'stock_movements.balance_after',
          'stock_movements.reason',
          'stock_movements.reference_type',
          'stock_movements.reference_id',
          'stock_movements.created_at',
          'users.name as user_name',
        ])
        .where('product_id', '=', id)
        .orderBy('stock_movements.created_at', 'desc')
        .limit(50)
        .execute(),
    ]);

    return { ...product, batches, movements };
  });

  app.post('/', async (request, reply) => {
    const body = productSchema.parse(request.body);

    const exists = await db
      .selectFrom('products')
      .select('id')
      .where('sku', '=', body.sku)
      .executeTakeFirst();
    if (exists) throw conflict('Já existe um produto com este SKU.');

    const settings = await db
      .selectFrom('company_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirst();

    const product = await db
      .insertInto('products')
      .values({
        ...body,
        ncm: body.ncm || settings?.default_ncm || '23091000',
        cfop: body.cfop || settings?.default_cfop || '5102',
        csosn: body.csosn || settings?.default_csosn || '102',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.code(201).send(product);
  });

  app.put('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = productSchema.parse(request.body);

    const exists = await db
      .selectFrom('products')
      .select('id')
      .where('sku', '=', body.sku)
      .where('id', '!=', id)
      .executeTakeFirst();
    if (exists) throw conflict('Já existe outro produto com este SKU.');

    // stock_qty nunca é editado direto: só por movimentação de estoque
    const product = await db
      .updateTable('products')
      .set(body)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!product) throw notFound('Produto');
    return product;
  });

  app.delete('/:id', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const updated = await db
      .updateTable('products')
      .set({ active: false })
      .where('id', '=', id)
      .returning('id')
      .executeTakeFirst();
    if (!updated) throw notFound('Produto');
    return { ok: true };
  });
}
