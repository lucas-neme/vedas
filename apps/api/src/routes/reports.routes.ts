import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { authenticate } from '../plugins/auth';

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function resolveRange(query: z.infer<typeof rangeSchema>) {
  const to = query.to ? new Date(`${query.to}T23:59:59`) : new Date();
  const from = query.from
    ? new Date(`${query.from}T00:00:00`)
    : new Date(new Date().setDate(new Date().getDate() - 29));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export async function reportsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  // ── Painel inicial ─────────────────────────────────────────────────────────
  app.get('/dashboard', async () => {
    const [today, month, salesByDay, topProducts, byCategory, stock, receivables, recentSales] =
      await Promise.all([
        db
          .selectFrom('sales')
          .select(({ fn }) => [
            fn.count<number>('id').as('count'),
            fn.sum<number>('total').as('total'),
            fn.sum<number>('cost_total').as('cost'),
          ])
          .where('status', '=', 'confirmada')
          .where(sql<boolean>`sold_at >= date_trunc('day', now())`)
          .executeTakeFirst(),
        db
          .selectFrom('sales')
          .select(({ fn }) => [
            fn.count<number>('id').as('count'),
            fn.sum<number>('total').as('total'),
            fn.sum<number>('cost_total').as('cost'),
          ])
          .where('status', '=', 'confirmada')
          .where(sql<boolean>`sold_at >= date_trunc('month', now())`)
          .executeTakeFirst(),
        db
          .selectFrom('sales')
          .select([
            sql<string>`to_char(date_trunc('day', sold_at), 'YYYY-MM-DD')`.as('day'),
            sql<number>`sum(total)`.as('total'),
            sql<number>`count(*)`.as('count'),
          ])
          .where('status', '=', 'confirmada')
          .where(sql<boolean>`sold_at >= current_date - interval '29 days'`)
          .groupBy(sql`date_trunc('day', sold_at)`)
          .orderBy(sql`date_trunc('day', sold_at)`)
          .execute(),
        db
          .selectFrom('sale_items')
          .innerJoin('sales', 'sales.id', 'sale_items.sale_id')
          .innerJoin('products', 'products.id', 'sale_items.product_id')
          .select([
            'products.id',
            'products.name',
            'products.sku',
            'products.unit',
            sql<number>`sum(sale_items.qty)`.as('qty'),
            sql<number>`sum(sale_items.total)`.as('total'),
          ])
          .where('sales.status', '=', 'confirmada')
          .where(sql<boolean>`sales.sold_at >= current_date - interval '29 days'`)
          .groupBy(['products.id', 'products.name', 'products.sku', 'products.unit'])
          .orderBy(sql`sum(sale_items.total)`, 'desc')
          .limit(8)
          .execute(),
        db
          .selectFrom('sale_items')
          .innerJoin('sales', 'sales.id', 'sale_items.sale_id')
          .innerJoin('products', 'products.id', 'sale_items.product_id')
          .leftJoin('categories', 'categories.id', 'products.category_id')
          .select([
            sql<string>`coalesce(categories.name, 'Sem categoria')`.as('category'),
            sql<number>`sum(sale_items.total)`.as('total'),
          ])
          .where('sales.status', '=', 'confirmada')
          .where(sql<boolean>`sales.sold_at >= current_date - interval '29 days'`)
          .groupBy(sql`coalesce(categories.name, 'Sem categoria')`)
          .orderBy(sql`sum(sale_items.total)`, 'desc')
          .limit(10)
          .execute(),
        db
          .selectFrom('products')
          .select(({ fn }) => [
            fn.count<number>('id').as('products'),
            sql<number>`count(*) filter (where stock_qty <= min_stock and min_stock > 0)`.as('low_stock'),
            sql<number>`coalesce(sum(stock_qty * cost_price), 0)`.as('stock_value'),
          ])
          .where('active', '=', true)
          .executeTakeFirst(),
        db
          .selectFrom('sale_payments')
          .innerJoin('sales', 'sales.id', 'sale_payments.sale_id')
          .select(({ fn }) => [
            fn.count<number>('sale_payments.id').as('count'),
            fn.sum<number>('sale_payments.amount').as('total'),
            sql<number>`coalesce(sum(sale_payments.amount) filter (where sale_payments.due_date < current_date), 0)`.as('overdue'),
          ])
          .where('sale_payments.paid', '=', false)
          .where('sales.status', '=', 'confirmada')
          .executeTakeFirst(),
        db
          .selectFrom('sales')
          .leftJoin('customers', 'customers.id', 'sales.customer_id')
          .select([
            'sales.id',
            'sales.number',
            'sales.total',
            'sales.status',
            'sales.sold_at',
            'customers.name as customer_name',
          ])
          .orderBy('sales.sold_at', 'desc')
          .limit(8)
          .execute(),
      ]);

    const expiring = await db
      .selectFrom('product_batches')
      .select(({ fn }) => [fn.count<number>('id').as('count')])
      .where('qty', '>', 0)
      .where(sql<boolean>`expires_at is not null and expires_at <= current_date + interval '60 days'`)
      .executeTakeFirst();

    const todayTotal = Number(today?.total ?? 0);
    const todayCount = Number(today?.count ?? 0);
    const monthTotal = Number(month?.total ?? 0);
    const monthCount = Number(month?.count ?? 0);

    return {
      today: {
        total: todayTotal,
        count: todayCount,
        averageTicket: todayCount > 0 ? todayTotal / todayCount : 0,
        margin: todayTotal - Number(today?.cost ?? 0),
      },
      month: {
        total: monthTotal,
        count: monthCount,
        averageTicket: monthCount > 0 ? monthTotal / monthCount : 0,
        margin: monthTotal - Number(month?.cost ?? 0),
      },
      salesByDay: salesByDay.map((row) => ({
        day: row.day,
        total: Number(row.total),
        count: Number(row.count),
      })),
      topProducts: topProducts.map((row) => ({
        ...row,
        qty: Number(row.qty),
        total: Number(row.total),
      })),
      byCategory: byCategory.map((row) => ({ ...row, total: Number(row.total) })),
      stock: {
        products: Number(stock?.products ?? 0),
        lowStock: Number(stock?.low_stock ?? 0),
        stockValue: Number(stock?.stock_value ?? 0),
        expiringBatches: Number(expiring?.count ?? 0),
      },
      receivables: {
        count: Number(receivables?.count ?? 0),
        total: Number(receivables?.total ?? 0),
        overdue: Number(receivables?.overdue ?? 0),
      },
      recentSales,
    };
  });

  // ── Vendas por período ─────────────────────────────────────────────────────
  app.get('/sales', async (request) => {
    const query = rangeSchema
      .extend({ groupBy: z.enum(['day', 'week', 'month']).default('day') })
      .parse(request.query);
    const { from, to } = resolveRange(query);
    // Enum validado pelo zod: entra como literal para que SELECT e GROUP BY
    // compartilhem exatamente a mesma expressão.
    const bucket = sql`date_trunc(${sql.lit(query.groupBy)}, sold_at)`;

    const rows = await db
      .selectFrom('sales')
      .select([
        sql<string>`to_char(${bucket}, 'YYYY-MM-DD')`.as('period'),
        sql<number>`count(*)`.as('count'),
        sql<number>`sum(total)`.as('total'),
        sql<number>`sum(cost_total)`.as('cost'),
        sql<number>`sum(discount)`.as('discount'),
      ])
      .where('status', '=', 'confirmada')
      .where('sold_at', '>=', from)
      .where('sold_at', '<=', to)
      .groupBy(bucket)
      .orderBy(bucket)
      .execute();

    const byPayment = await db
      .selectFrom('sale_payments')
      .innerJoin('sales', 'sales.id', 'sale_payments.sale_id')
      .select([
        'sale_payments.method',
        sql<number>`sum(sale_payments.amount)`.as('total'),
        sql<number>`count(*)`.as('count'),
      ])
      .where('sales.status', '=', 'confirmada')
      .where('sales.sold_at', '>=', from)
      .where('sales.sold_at', '<=', to)
      .groupBy('sale_payments.method')
      .orderBy(sql`sum(sale_payments.amount)`, 'desc')
      .execute();

    return {
      periods: rows.map((row) => ({
        period: row.period,
        count: Number(row.count),
        total: Number(row.total),
        cost: Number(row.cost),
        margin: Number(row.total) - Number(row.cost),
        discount: Number(row.discount),
      })),
      byPayment: byPayment.map((row) => ({
        method: row.method,
        total: Number(row.total),
        count: Number(row.count),
      })),
    };
  });

  // ── Curva de produtos (mais vendidos e margem) ─────────────────────────────
  app.get('/products', async (request) => {
    const query = rangeSchema.extend({ limit: z.coerce.number().min(1).max(200).default(50) }).parse(
      request.query,
    );
    const { from, to } = resolveRange(query);

    const rows = await db
      .selectFrom('sale_items')
      .innerJoin('sales', 'sales.id', 'sale_items.sale_id')
      .innerJoin('products', 'products.id', 'sale_items.product_id')
      .leftJoin('categories', 'categories.id', 'products.category_id')
      .select([
        'products.id',
        'products.sku',
        'products.name',
        'products.unit',
        'products.stock_qty',
        'categories.name as category_name',
        sql<number>`sum(sale_items.qty)`.as('qty'),
        sql<number>`sum(sale_items.total)`.as('revenue'),
        sql<number>`sum(sale_items.qty * sale_items.unit_cost)`.as('cost'),
      ])
      .where('sales.status', '=', 'confirmada')
      .where('sales.sold_at', '>=', from)
      .where('sales.sold_at', '<=', to)
      .groupBy([
        'products.id',
        'products.sku',
        'products.name',
        'products.unit',
        'products.stock_qty',
        'categories.name',
      ])
      .orderBy(sql`sum(sale_items.total)`, 'desc')
      .limit(query.limit)
      .execute();

    return rows.map((row) => {
      const revenue = Number(row.revenue);
      const cost = Number(row.cost);
      return {
        ...row,
        qty: Number(row.qty),
        revenue,
        cost,
        margin: revenue - cost,
        marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      };
    });
  });

  // ── Melhores clientes ──────────────────────────────────────────────────────
  app.get('/customers', async (request) => {
    const query = rangeSchema.extend({ limit: z.coerce.number().min(1).max(200).default(30) }).parse(
      request.query,
    );
    const { from, to } = resolveRange(query);

    return db
      .selectFrom('sales')
      .innerJoin('customers', 'customers.id', 'sales.customer_id')
      .select([
        'customers.id',
        'customers.name',
        'customers.phone',
        'customers.email',
        sql<number>`count(*)`.as('sales_count'),
        sql<number>`sum(sales.total)`.as('total'),
        sql<number>`avg(sales.total)`.as('average_ticket'),
        sql<string>`to_char(max(sales.sold_at), 'YYYY-MM-DD')`.as('last_purchase'),
      ])
      .where('sales.status', '=', 'confirmada')
      .where('sales.sold_at', '>=', from)
      .where('sales.sold_at', '<=', to)
      .groupBy(['customers.id', 'customers.name', 'customers.phone', 'customers.email'])
      .orderBy(sql`sum(sales.total)`, 'desc')
      .limit(query.limit)
      .execute();
  });

  /**
   * Previsão de recompra de ração.
   *
   * Usa o consumo diário informado no cadastro do pet e o peso da embalagem
   * para estimar quando o cliente deve voltar à loja — base para a régua de
   * contato no WhatsApp.
   */
  app.get('/repurchase', async (request) => {
    const { withinDays } = z
      .object({ withinDays: z.coerce.number().min(1).max(365).default(15) })
      .parse(request.query);

    const rows = await sql<{
      pet_id: number;
      pet_name: string;
      species: string;
      customer_id: number;
      customer_name: string;
      customer_phone: string;
      product_id: number;
      product_name: string;
      package_weight_kg: number | null;
      daily_food_grams: number | null;
      last_purchase: string | null;
      days_of_food: number | null;
      expected_date: string | null;
      days_remaining: number | null;
    }>`
      WITH ultima_compra AS (
        SELECT s.customer_id,
               si.product_id,
               MAX(s.sold_at) AS sold_at
          FROM sale_items si
          JOIN sales s ON s.id = si.sale_id
         WHERE s.status = 'confirmada'
         GROUP BY s.customer_id, si.product_id
      )
      SELECT p.id                                   AS pet_id,
             p.name                                 AS pet_name,
             p.species                              AS species,
             c.id                                   AS customer_id,
             c.name                                 AS customer_name,
             c.phone                                AS customer_phone,
             pr.id                                  AS product_id,
             pr.name                                AS product_name,
             pr.package_weight_kg,
             p.daily_food_grams,
             to_char(uc.sold_at, 'YYYY-MM-DD')       AS last_purchase,
             floor((pr.package_weight_kg * 1000) / NULLIF(p.daily_food_grams, 0))::int AS days_of_food,
             to_char(
               uc.sold_at
                 + make_interval(days => floor((pr.package_weight_kg * 1000) / NULLIF(p.daily_food_grams, 0))::int),
               'YYYY-MM-DD'
             )                                       AS expected_date,
             (
               (uc.sold_at
                 + make_interval(days => floor((pr.package_weight_kg * 1000) / NULLIF(p.daily_food_grams, 0))::int))::date
               - current_date
             )                                       AS days_remaining
        FROM pets p
        JOIN customers c ON c.id = p.customer_id
        JOIN products pr ON pr.id = p.food_product_id
        LEFT JOIN ultima_compra uc
               ON uc.customer_id = p.customer_id AND uc.product_id = p.food_product_id
       WHERE p.active
         AND c.active
         AND p.daily_food_grams > 0
         AND pr.package_weight_kg > 0
    `.execute(db);

    const data = rows.rows
      .map((row) => ({
        ...row,
        daysRemaining: row.days_remaining === null ? null : Number(row.days_remaining),
      }))
      .sort((a, b) => (a.daysRemaining ?? 9999) - (b.daysRemaining ?? 9999));

    return {
      withinDays,
      due: data.filter((row) => row.daysRemaining !== null && row.daysRemaining <= withinDays),
      all: data,
    };
  });

  /** Clientes sem compras há N dias — base para reativação. */
  app.get('/inactive-customers', async (request) => {
    const { days } = z.object({ days: z.coerce.number().min(7).max(730).default(90) }).parse(
      request.query,
    );

    const rows = await sql<{
      id: number;
      name: string;
      phone: string;
      email: string;
      last_purchase: string | null;
      days_since: number | null;
      total_spent: number;
    }>`
      SELECT c.id,
             c.name,
             c.phone,
             c.email,
             to_char(MAX(s.sold_at), 'YYYY-MM-DD') AS last_purchase,
             (current_date - MAX(s.sold_at)::date) AS days_since,
             COALESCE(SUM(s.total), 0)             AS total_spent
        FROM customers c
        LEFT JOIN sales s ON s.customer_id = c.id AND s.status = 'confirmada'
       WHERE c.active
       GROUP BY c.id, c.name, c.phone, c.email
      HAVING MAX(s.sold_at) IS NOT NULL
         AND (current_date - MAX(s.sold_at)::date) >= ${days}
       ORDER BY days_since DESC
       LIMIT 200
    `.execute(db);

    return rows.rows.map((row) => ({
      ...row,
      days_since: Number(row.days_since),
      total_spent: Number(row.total_spent),
    }));
  });
}
