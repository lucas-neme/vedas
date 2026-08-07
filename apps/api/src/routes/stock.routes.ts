import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { badRequest, notFound } from '../lib/errors';
import { paginated, paginationSchema } from '../lib/pagination';
import { authenticate, requireRole, type AuthUser } from '../plugins/auth';
import { applyStockMovement, upsertBatch, weightedAverageCost } from '../services/stock.service';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).')
  .nullish()
  .transform((value) => value ?? null);

const entrySchema = z.object({
  product_id: z.coerce.number().int().positive(),
  qty: z.coerce.number().positive('A quantidade deve ser maior que zero.'),
  unit_cost: z.coerce.number().min(0).default(0),
  batch_code: z.string().trim().default(''),
  expires_at: dateString,
  supplier_id: z.coerce.number().int().nullish().transform((v) => v ?? null),
  invoice_number: z.string().trim().default(''),
  update_cost_price: z.boolean().default(true),
  reason: z.string().trim().default(''),
});

const adjustmentSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  /** Saldo real contado no inventário. */
  counted_qty: z.coerce.number().min(0),
  reason: z.string().trim().min(3, 'Descreva o motivo do ajuste.'),
});

const lossSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  batch_id: z.coerce.number().int().nullish().transform((v) => v ?? null),
  qty: z.coerce.number().positive(),
  reason: z.string().trim().min(3, 'Descreva o motivo da baixa (vencimento, avaria...).'),
});

export async function stockRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // ── Histórico de movimentações ─────────────────────────────────────────────
  app.get('/movements', async (request) => {
    const query = paginationSchema
      .extend({
        productId: z.coerce.number().optional(),
        type: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(request.query);

    let base = db.selectFrom('stock_movements');
    if (query.productId) base = base.where('stock_movements.product_id', '=', query.productId);
    if (query.type) base = base.where('stock_movements.type', '=', query.type as never);
    if (query.from) base = base.where('stock_movements.created_at', '>=', new Date(query.from));
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      base = base.where('stock_movements.created_at', '<=', to);
    }

    const [rows, count] = await Promise.all([
      base
        .innerJoin('products', 'products.id', 'stock_movements.product_id')
        .leftJoin('users', 'users.id', 'stock_movements.user_id')
        .leftJoin('product_batches', 'product_batches.id', 'stock_movements.batch_id')
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
          'products.id as product_id',
          'products.name as product_name',
          'products.sku as product_sku',
          'products.unit as product_unit',
          'users.name as user_name',
          'product_batches.batch_code',
        ])
        .orderBy('stock_movements.created_at', 'desc')
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .execute(),
      base.select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirst(),
    ]);

    return paginated(rows, Number(count?.count ?? 0), query);
  });

  // ── Lotes ──────────────────────────────────────────────────────────────────
  app.get('/batches', async (request) => {
    const query = z
      .object({
        productId: z.coerce.number().optional(),
        expiringDays: z.coerce.number().optional(),
        onlyWithStock: z.enum(['true', 'false']).default('true'),
      })
      .parse(request.query);

    let base = db
      .selectFrom('product_batches')
      .innerJoin('products', 'products.id', 'product_batches.product_id');

    if (query.productId) base = base.where('product_batches.product_id', '=', query.productId);
    if (query.onlyWithStock === 'true') base = base.where('product_batches.qty', '>', 0);
    if (query.expiringDays !== undefined) {
      base = base.where(
        sql<boolean>`product_batches.expires_at <= current_date + ${query.expiringDays}::int`,
      );
    }

    return base
      .select([
        'product_batches.id',
        'product_batches.product_id',
        'product_batches.batch_code',
        'product_batches.expires_at',
        'product_batches.qty',
        'product_batches.cost_price',
        'product_batches.received_at',
        'products.name as product_name',
        'products.sku as product_sku',
        'products.unit as product_unit',
        sql<number>`(product_batches.expires_at - current_date)`.as('days_to_expire'),
      ])
      .orderBy('product_batches.expires_at', sql`asc nulls last`)
      .limit(500)
      .execute();
  });

  // ── Alertas operacionais ───────────────────────────────────────────────────
  app.get('/alerts', async () => {
    const settings = await db
      .selectFrom('company_settings')
      .select('expiry_alert_days')
      .where('id', '=', 1)
      .executeTakeFirst();

    const alertDays = settings?.expiry_alert_days ?? 60;

    const [lowStock, expiring, expired] = await Promise.all([
      db
        .selectFrom('products')
        .leftJoin('brands', 'brands.id', 'products.brand_id')
        .select([
          'products.id',
          'products.sku',
          'products.name',
          'products.unit',
          'products.stock_qty',
          'products.min_stock',
          'products.sale_price',
          'brands.name as brand_name',
        ])
        .where('products.active', '=', true)
        .where(sql<boolean>`products.stock_qty <= products.min_stock`)
        .where('products.min_stock', '>', 0)
        .orderBy(sql`products.stock_qty - products.min_stock`)
        .limit(100)
        .execute(),
      db
        .selectFrom('product_batches')
        .innerJoin('products', 'products.id', 'product_batches.product_id')
        .select([
          'product_batches.id',
          'product_batches.batch_code',
          'product_batches.expires_at',
          'product_batches.qty',
          'products.id as product_id',
          'products.name as product_name',
          'products.sku as product_sku',
          sql<number>`(product_batches.expires_at - current_date)`.as('days_to_expire'),
        ])
        .where('product_batches.qty', '>', 0)
        .where(sql<boolean>`product_batches.expires_at >= current_date`)
        .where(sql<boolean>`product_batches.expires_at <= current_date + ${alertDays}::int`)
        .orderBy('product_batches.expires_at')
        .limit(100)
        .execute(),
      db
        .selectFrom('product_batches')
        .innerJoin('products', 'products.id', 'product_batches.product_id')
        .select([
          'product_batches.id',
          'product_batches.batch_code',
          'product_batches.expires_at',
          'product_batches.qty',
          'products.id as product_id',
          'products.name as product_name',
          'products.sku as product_sku',
        ])
        .where('product_batches.qty', '>', 0)
        .where(sql<boolean>`product_batches.expires_at < current_date`)
        .orderBy('product_batches.expires_at')
        .limit(100)
        .execute(),
    ]);

    return { alertDays, lowStock, expiring, expired };
  });

  // ── Entrada de mercadoria ──────────────────────────────────────────────────
  app.post('/entries', async (request, reply) => {
    const body = entrySchema.parse(request.body);
    const auth = request.user as AuthUser;

    const result = await db.transaction().execute(async (trx) => {
      const product = await trx
        .selectFrom('products')
        .select(['id', 'requires_batch', 'stock_qty', 'cost_price'])
        .where('id', '=', body.product_id)
        .executeTakeFirst();

      if (!product) throw notFound('Produto');

      let batchId: number | null = null;
      if (product.requires_batch && body.batch_code) {
        batchId = await upsertBatch(trx, {
          productId: body.product_id,
          batchCode: body.batch_code,
          expiresAt: body.expires_at,
          costPrice: body.unit_cost,
        });
      }

      const reasonParts = [body.reason || 'Entrada de mercadoria'];
      if (body.invoice_number) reasonParts.push(`NF ${body.invoice_number}`);

      const { balance } = await applyStockMovement(trx, {
        productId: body.product_id,
        batchId,
        type: 'entrada',
        qty: body.qty,
        unitCost: body.unit_cost,
        reason: reasonParts.join(' · '),
        referenceType: 'compra',
        referenceId: body.supplier_id,
        userId: auth.id,
      });

      if (body.update_cost_price && body.unit_cost > 0) {
        const newCost = weightedAverageCost(
          Number(product.stock_qty),
          Number(product.cost_price),
          body.qty,
          body.unit_cost,
        );
        await trx
          .updateTable('products')
          .set({ cost_price: newCost })
          .where('id', '=', body.product_id)
          .execute();
      }

      if (body.supplier_id) {
        await trx
          .updateTable('products')
          .set({ supplier_id: body.supplier_id })
          .where('id', '=', body.product_id)
          .execute();
      }

      return { balance, batchId };
    });

    return reply.code(201).send(result);
  });

  // ── Ajuste de inventário ───────────────────────────────────────────────────
  app.post('/adjustments', { preHandler: requireRole('admin', 'gerente') }, async (request, reply) => {
    const body = adjustmentSchema.parse(request.body);
    const auth = request.user as AuthUser;

    const result = await db.transaction().execute(async (trx) => {
      const product = await trx
        .selectFrom('products')
        .select(['id', 'stock_qty'])
        .where('id', '=', body.product_id)
        .executeTakeFirst();
      if (!product) throw notFound('Produto');

      const delta = Number((body.counted_qty - Number(product.stock_qty)).toFixed(3));
      if (delta === 0) throw badRequest('O saldo contado é igual ao saldo atual.');

      return applyStockMovement(trx, {
        productId: body.product_id,
        type: 'ajuste',
        qty: delta,
        reason: `Inventário: ${body.reason}`,
        referenceType: 'inventario',
        userId: auth.id,
        allowNegative: true,
      });
    });

    return reply.code(201).send(result);
  });

  // ── Perda / vencimento / avaria ────────────────────────────────────────────
  app.post('/losses', async (request, reply) => {
    const body = lossSchema.parse(request.body);
    const auth = request.user as AuthUser;

    const result = await db.transaction().execute(async (trx) =>
      applyStockMovement(trx, {
        productId: body.product_id,
        batchId: body.batch_id,
        type: 'perda',
        qty: -body.qty,
        reason: body.reason,
        referenceType: 'perda',
        userId: auth.id,
      }),
    );

    return reply.code(201).send(result);
  });
}
